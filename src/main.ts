import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.useStaticAssets(join(process.cwd(), 'public', 'demo', 'assets'), {
    prefix: '/demo-assets/',
  });

  app.useStaticAssets(join(process.cwd(), 'public'));

  app.useStaticAssets(join(process.cwd(), 'node_modules', 'socket.io', 'client-dist'), {
    prefix: '/socket.io-client/',
  });

  if (configService.get<string>('UPLOAD_STORAGE_PROVIDER', 'local') === 'local') {
    app.useStaticAssets(join(process.cwd(), configService.get<string>('UPLOAD_LOCAL_DIR', 'uploads')), {
      prefix: '/uploads/',
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerEnabled = configService.get<string>('SWAGGER_ENABLED', 'true') === 'true';
  if (swaggerEnabled) {
    const swaggerPath = configService.get<string>('SWAGGER_PATH', 'docs');
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Threads-like Backend API')
      .setDescription('Mobile-first APIs for a Threads-like social networking backend.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Application is running on http://localhost:${port}`);
}

void bootstrap();
