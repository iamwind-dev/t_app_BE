import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import type { HealthResponse } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOkResponse({
    description: 'Application health status.',
    schema: {
      example: {
        success: true,
        data: {
          status: 'ok',
          service: 't-app-backend',
          timestamp: '2026-05-23T00:00:00.000Z',
        },
      },
    },
  })
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }
}
