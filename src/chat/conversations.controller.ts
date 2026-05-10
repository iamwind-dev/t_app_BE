import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import {
  ConversationIdParamDto,
  ConversationMessageParamDto,
  DirectConversationParamDto,
} from './dto/chat-params.dto';
import { MarkSeenBodyDto } from './dto/mark-seen.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { SendMessageBodyDto } from './dto/send-message.dto';
import {
  ConversationListResponse,
  ConversationResponse,
  DeleteMessageResponse,
  MarkSeenResult,
  MessageListResponse,
  SendMessageResult,
} from './types/chat-response.type';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly chatService: ChatService) {}

  @Post('direct/:userId')
  @ApiCreatedResponse({ description: 'Direct conversation created or returned.' })
  createDirectConversation(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: DirectConversationParamDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ConversationResponse> {
    return this.chatService
      .createOrGetDirectConversation(currentUser.id, params.userId)
      .then((result) => {
        response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);

        return {
          conversation: result.conversation,
        };
      });
  }

  @Get()
  @ApiOkResponse({ description: 'Current user conversations.' })
  listConversations(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: ConversationQueryDto,
  ): Promise<ConversationListResponse> {
    return this.chatService.listConversations(currentUser.id, query);
  }

  @Get(':id/messages')
  @ApiOkResponse({ description: 'Conversation message history.' })
  getMessages(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ConversationIdParamDto,
    @Query() query: MessagesQueryDto,
  ): Promise<MessageListResponse> {
    return this.chatService.getMessages(currentUser.id, params.id, query);
  }

  @Post(':id/messages')
  @ApiCreatedResponse({ description: 'Message sent over REST.' })
  sendMessage(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ConversationIdParamDto,
    @Body() body: SendMessageBodyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SendMessageResult> {
    response.status(HttpStatus.CREATED);
    return this.chatService.sendTextMessage(currentUser.id, {
      conversationId: params.id,
      ...(body.clientMessageId ? { clientMessageId: body.clientMessageId } : {}),
      ...(body.clientTempId ? { clientTempId: body.clientTempId } : {}),
      ...(body.content ? { content: body.content } : {}),
      ...(body.text ? { text: body.text } : {}),
      type: 'text',
    });
  }

  @Post(':id/seen')
  @ApiOkResponse({ description: 'Conversation message marked as seen over REST.' })
  markSeen(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ConversationIdParamDto,
    @Body() body: MarkSeenBodyDto,
  ): Promise<MarkSeenResult> {
    return this.chatService.markSeen(currentUser.id, {
      conversationId: params.id,
      messageId: body.messageId,
    });
  }

  @Delete(':id/messages/:messageId')
  @ApiOkResponse({ description: 'Conversation message soft deleted.' })
  deleteMessage(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param() params: ConversationMessageParamDto,
  ): Promise<DeleteMessageResponse> {
    return this.chatService.deleteMessage(currentUser.id, params.id, params.messageId);
  }
}
