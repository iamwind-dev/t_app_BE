param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [string]$EnvFile = ".env",
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

function Get-DatabaseUrl {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Env file not found: $Path"
  }

  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
    Select-Object -First 1

  if (-not $line) {
    throw "DATABASE_URL was not found in $Path"
  }

  return ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
}

function Add-SslModeIfMissing {
  param([string]$DatabaseUrl)

  if ($DatabaseUrl -match '(\?|&)sslmode=') {
    return $DatabaseUrl
  }

  if ($DatabaseUrl.Contains("?")) {
    return "$DatabaseUrl&sslmode=require"
  }

  return "$DatabaseUrl?sslmode=require"
}

function ConvertTo-PostgresConnection {
  param([string]$DatabaseUrl)

  $uri = [Uri]$DatabaseUrl
  $userInfo = $uri.UserInfo.Split(":", 2)

  if ($userInfo.Count -ne 2) {
    throw "DATABASE_URL must include both username and password."
  }

  $port = $uri.Port
  if ($port -lt 0) {
    $port = 5432
  }

  return @{
    Host = $uri.Host
    Port = $port
    User = [Uri]::UnescapeDataString($userInfo[0])
    Password = [Uri]::UnescapeDataString($userInfo[1])
    Database = $uri.AbsolutePath.TrimStart("/")
  }
}

function Get-PostgresToolPath {
  param([string]$ToolName)

  $command = Get-Command $ToolName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $commonMatches = @(
    "C:\Program Files\PostgreSQL\*\bin\$ToolName.exe",
    "C:\Program Files\PostgreSQL\*\pgAdmin 4\runtime\$ToolName.exe"
  )

  foreach ($pattern in $commonMatches) {
    $match = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      Select-Object -First 1

    if ($match) {
      return $match.FullName
    }
  }

  return $null
}

$pgRestore = Get-PostgresToolPath "pg_restore"

if (-not $pgRestore) {
  throw "pg_restore was not found. Install PostgreSQL 17+ client tools, then run this script again."
}

if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

$connection = ConvertTo-PostgresConnection (Get-DatabaseUrl $EnvFile)
$args = @(
  "--no-owner",
  "--no-privileges",
  "--verbose",
  "-h", $connection.Host,
  "-p", $connection.Port,
  "-U", $connection.User,
  "-d", $connection.Database
)

if ($Clean) {
  $args += @("--clean", "--if-exists")
}

$args += $BackupFile

Write-Host "Restoring PostgreSQL backup..."
if ($Clean) {
  Write-Host "Clean restore is enabled. Existing database objects may be dropped first."
}

$oldPgPassword = $env:PGPASSWORD
$oldPgSslMode = $env:PGSSLMODE

try {
  $env:PGPASSWORD = $connection.Password
  $env:PGSSLMODE = "require"

  & $pgRestore @args
} finally {
  if ($null -eq $oldPgPassword) {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  } else {
    $env:PGPASSWORD = $oldPgPassword
  }

  if ($null -eq $oldPgSslMode) {
    Remove-Item Env:\PGSSLMODE -ErrorAction SilentlyContinue
  } else {
    $env:PGSSLMODE = $oldPgSslMode
  }
}

if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE."
}

Write-Host "Restore finished."
