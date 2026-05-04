import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [ConversationsController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
