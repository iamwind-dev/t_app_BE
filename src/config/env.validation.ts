interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_ACCESS_EXPIRES_IN: string;
  CORS_ORIGINS: string;
  SWAGGER_ENABLED: string;
  SWAGGER_PATH: string;
  UPLOAD_STORAGE_PROVIDER: string;
  UPLOAD_LOCAL_DIR: string;
  UPLOAD_PUBLIC_BASE_URL: string;
  UPLOAD_MAX_IMAGE_SIZE_BYTES: number;
  UPLOAD_MAX_VIDEO_SIZE_BYTES: number;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_UPLOAD_FOLDER: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  UPLOAD_PENDING_TTL_HOURS: number;
  AI_SERVICE_URL: string;
  AI_SERVICE_TIMEOUT_MS: number;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const port = Number(config.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const uploadMaxImageSizeBytes = Number(config.UPLOAD_MAX_IMAGE_SIZE_BYTES ?? 5 * 1024 * 1024);

  if (
    !Number.isInteger(uploadMaxImageSizeBytes) ||
    uploadMaxImageSizeBytes < 1 ||
    uploadMaxImageSizeBytes > 20 * 1024 * 1024
  ) {
    throw new Error('UPLOAD_MAX_IMAGE_SIZE_BYTES must be an integer between 1 and 20971520.');
  }

  const uploadMaxVideoSizeBytes = Number(config.UPLOAD_MAX_VIDEO_SIZE_BYTES ?? 25 * 1024 * 1024);

  if (
    !Number.isInteger(uploadMaxVideoSizeBytes) ||
    uploadMaxVideoSizeBytes < 1 ||
    uploadMaxVideoSizeBytes > 200 * 1024 * 1024
  ) {
    throw new Error('UPLOAD_MAX_VIDEO_SIZE_BYTES must be an integer between 1 and 209715200.');
  }

  const uploadPendingTtlHours = Number(config.UPLOAD_PENDING_TTL_HOURS ?? 24);

  if (
    !Number.isInteger(uploadPendingTtlHours) ||
    uploadPendingTtlHours < 1 ||
    uploadPendingTtlHours > 24 * 30
  ) {
    throw new Error('UPLOAD_PENDING_TTL_HOURS must be an integer between 1 and 720.');
  }

  const aiServiceTimeoutMs = Number(
    config.AI_SERVICE_TIMEOUT_MS ?? config.AI_MODERATION_TIMEOUT_MS ?? 8000,
  );
  if (!Number.isInteger(aiServiceTimeoutMs) || aiServiceTimeoutMs < 100 || aiServiceTimeoutMs > 60000) {
    throw new Error('AI_SERVICE_TIMEOUT_MS must be an integer between 100 and 60000.');
  }

  const nodeEnv = getString(config.NODE_ENV, 'development');
  const uploadPublicBaseUrl = getString(config.UPLOAD_PUBLIC_BASE_URL, 'https://localhost:3000/uploads');
  const isNonDev = nodeEnv !== 'development' && nodeEnv !== 'test';
  if (isNonDev && isLocalhostUrl(uploadPublicBaseUrl)) {
    throw new Error('UPLOAD_PUBLIC_BASE_URL must be publicly accessible and must not use localhost in non-development environments.');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL:
      typeof config.DATABASE_URL === 'string' && config.DATABASE_URL.length > 0
        ? config.DATABASE_URL
        : undefined,
    JWT_ACCESS_SECRET:
      typeof config.JWT_ACCESS_SECRET === 'string' && config.JWT_ACCESS_SECRET.length > 0
        ? config.JWT_ACCESS_SECRET
        : undefined,
    JWT_ACCESS_EXPIRES_IN: getString(config.JWT_ACCESS_EXPIRES_IN, '1h'),
    CORS_ORIGINS: getString(config.CORS_ORIGINS, ''),
    SWAGGER_ENABLED: getString(config.SWAGGER_ENABLED, 'true'),
    SWAGGER_PATH: getString(config.SWAGGER_PATH, 'docs'),
    UPLOAD_STORAGE_PROVIDER: getString(config.UPLOAD_STORAGE_PROVIDER, 'local'),
    UPLOAD_LOCAL_DIR: getString(config.UPLOAD_LOCAL_DIR, 'uploads'),
    UPLOAD_PUBLIC_BASE_URL: uploadPublicBaseUrl,
    UPLOAD_MAX_IMAGE_SIZE_BYTES: uploadMaxImageSizeBytes,
    UPLOAD_MAX_VIDEO_SIZE_BYTES: uploadMaxVideoSizeBytes,
    CLOUDINARY_CLOUD_NAME:
      typeof config.CLOUDINARY_CLOUD_NAME === 'string' && config.CLOUDINARY_CLOUD_NAME.length > 0
        ? config.CLOUDINARY_CLOUD_NAME
        : undefined,
    CLOUDINARY_API_KEY:
      typeof config.CLOUDINARY_API_KEY === 'string' && config.CLOUDINARY_API_KEY.length > 0
        ? config.CLOUDINARY_API_KEY
        : undefined,
    CLOUDINARY_API_SECRET:
      typeof config.CLOUDINARY_API_SECRET === 'string' && config.CLOUDINARY_API_SECRET.length > 0
        ? config.CLOUDINARY_API_SECRET
        : undefined,
    CLOUDINARY_UPLOAD_FOLDER: getString(config.CLOUDINARY_UPLOAD_FOLDER, 'threads-like'),
    FIREBASE_SERVICE_ACCOUNT_JSON:
      typeof config.FIREBASE_SERVICE_ACCOUNT_JSON === 'string' &&
      config.FIREBASE_SERVICE_ACCOUNT_JSON.length > 0
        ? config.FIREBASE_SERVICE_ACCOUNT_JSON
        : undefined,
    FIREBASE_PROJECT_ID:
      typeof config.FIREBASE_PROJECT_ID === 'string' && config.FIREBASE_PROJECT_ID.length > 0
        ? config.FIREBASE_PROJECT_ID
        : undefined,
    FIREBASE_CLIENT_EMAIL:
      typeof config.FIREBASE_CLIENT_EMAIL === 'string' &&
      config.FIREBASE_CLIENT_EMAIL.length > 0
        ? config.FIREBASE_CLIENT_EMAIL
        : undefined,
    FIREBASE_PRIVATE_KEY:
      typeof config.FIREBASE_PRIVATE_KEY === 'string' && config.FIREBASE_PRIVATE_KEY.length > 0
        ? config.FIREBASE_PRIVATE_KEY
        : undefined,
    UPLOAD_PENDING_TTL_HOURS: uploadPendingTtlHours,
    AI_SERVICE_URL: getString(
      config.AI_SERVICE_URL ?? config.AI_MODERATION_BASE_URL,
      'http://localhost:8000',
    ),
    AI_SERVICE_TIMEOUT_MS: aiServiceTimeoutMs,
  };
}

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return value.includes('localhost');
  }
}
