import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DomainEventsController } from './domain-events.controller';
import { DomainEventsService } from './domain-events.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventsService } from './realtime-events.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DomainEventsController],
  providers: [
    DomainEventsService,
    RealtimeEventsService,
    RealtimeGateway,
    OutboxPublisherService,
  ],
  exports: [DomainEventsService, RealtimeEventsService],
})
export class DomainEventsModule {}
