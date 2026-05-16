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
  UPLOAD_PENDING_TTL_HOURS: number;
  AI_MODERATION_BASE_URL: string;
  AI_MODERATION_TIMEOUT_MS: number;
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

  const aiModerationTimeoutMs = Number(config.AI_MODERATION_TIMEOUT_MS ?? 5000);
  if (!Number.isInteger(aiModerationTimeoutMs) || aiModerationTimeoutMs < 100 || aiModerationTimeoutMs > 60000) {
    throw new Error('AI_MODERATION_TIMEOUT_MS must be an integer between 100 and 60000.');
  }

  return {
    NODE_ENV: getString(config.NODE_ENV, 'development'),
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
    UPLOAD_PUBLIC_BASE_URL: getString(
      config.UPLOAD_PUBLIC_BASE_URL,
      'https://localhost:3000/uploads',
    ),
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
    UPLOAD_PENDING_TTL_HOURS: uploadPendingTtlHours,
    AI_MODERATION_BASE_URL: getString(config.AI_MODERATION_BASE_URL, 'http://localhost:8000'),
    AI_MODERATION_TIMEOUT_MS: aiModerationTimeoutMs,
  };
}

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
