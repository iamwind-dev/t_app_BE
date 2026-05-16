import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';

@Controller('demo')
export class DemoController {
  @Get()
  index(@Res() response: Response): void {
    response.sendFile(join(process.cwd(), 'public', 'demo', 'index.html'));
  }

  @Get('fcm')
  fcmDemo(@Res() response: Response): void {
    response.sendFile(join(process.cwd(), 'public', 'demo', 'fcm.html'));
  }
}
