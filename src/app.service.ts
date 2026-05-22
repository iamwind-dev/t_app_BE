import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  service: 't-app-backend';
  timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 't-app-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
