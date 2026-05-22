import 'dotenv/config';

type EnvSource = Record<string, string | undefined>;

export function getCorsOrigins(env: EnvSource): true | string[] {
  const rawOrigins = env.CORS_ORIGIN ?? env.CORS_ORIGINS ?? '';
  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : true;
}
