import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarkSeenPayloadDto, SendMessagePayloadDto } from './dto/socket-chat.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import {
  ChatUserSummary,
  ConversationListResponse,
  ConversationMemberResponse,
  ConversationResponseItem,
  DeleteMessageResponse,
  DirectConversationResult,
  MarkSeenResult,
  MessageListResponse,
  MessageResponseItem,
  SendMessageResult,
} from './types/chat-response.type';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface ConversationMemberRecord {
  userId: string;
  user: ChatUserSummary;
  joinedAt: Date;
  lastSeenMessageId: string | null;
  lastSeenAt: Date | null;
}

interface MessageRecord {
  id: string;
  conversationId: string;
  senderId?: string;
  sender: ChatUserSummary;
  type: string;
  content?: string | null;
  text: string | null;
  mediaUrl?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationRecord {
  id: string;
  type: string;
  members: ConversationMemberRecord[];
  messages?: MessageRecord[];
  createdAt: Date;
  updatedAt: Date;
}

interface TransactionClient {
  conversation: {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  message: {
    create(args: unknown): Promise<unknown>;
  };
}

const chatUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
};

const conversationInclude = {
  members: {
    include: {
      user: {
        select: chatUserSelect,
      },
    },
    orderBy: {
      joinedAt: 'asc' as const,
    },
  },
  messages: {
    where: {
      deletedAt: null,
    },
    take: 1,
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    include: {
      sender: {
        select: chatUserSelect,
      },
    },
  },
};

const messageInclude = {
  sender: {
    select: chatUserSelect,
  },
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOrGetDirectConversation(
    currentUserId: string,
    targetUserId: string,
  ): Promise<DirectConversationResult> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException({
        code: 'CHAT_CANNOT_MESSAGE_SELF',
        message: 'Cannot create a direct conversation with yourself.',
      });
    }

    await this.ensureTargetUserExists(targetUserId);

    const directKey = this.buildDirectKey(currentUserId, targetUserId);
    const existingConversation = (await this.prisma.conversation.findUnique({
      where: { directKey },
      include: conversationInclude,
    })) as ConversationRecord | null;

    if (existingConversation) {
      return {
        conversation: await this.toConversationResponse(existingConversation, currentUserId, false),
        created: false,
      };
    }

    try {
      const conversation = await this.prisma.$transaction(async (tx) => {
        const client = tx as unknown as TransactionClient;

        return (await client.conversation.create({
          data: {
            type: 'DIRECT',
            directKey,
            members: {
              create: [{ userId: currentUserId }, { userId: targetUserId }],
            },
          },
          include: conversationInclude,
        })) as ConversationRecord;
      });

      return {
        conversation: await this.toConversationResponse(conversation, currentUserId, false),
        created: true,
      };
    } catch (error) {
      if (!this.isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const conversation = (await this.prisma.conversation.findUnique({
        where: { directKey },
        include: conversationInclude,
      })) as ConversationRecord | null;

      if (!conversation) {
        throw error;
      }

      return {
        conversation: await this.toConversationResponse(conversation, currentUserId, false),
        created: false,
      };
    }
  }

  async listConversations(
    currentUserId: string,
    query: ConversationQueryDto,
  ): Promise<ConversationListResponse> {
    const limit = query.limit ?? 20;
    const conversations = (await this.prisma.conversation.findMany({
      where: {
        members: {
          some: {
            userId: currentUserId,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: conversationInclude,
    })) as unknown as ConversationRecord[];

    const hasNextPage = conversations.length > limit;
    const items = await Promise.all(
      conversations
        .slice(0, limit)
        .map((conversation) => this.toConversationResponse(conversation, currentUserId, true)),
    );

    return {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? (items[items.length - 1]?.id ?? null) : null,
        hasNextPage,
      },
    };
  }

  async getMessages(
    currentUserId: string,
    conversationId: string,
    query: MessagesQueryDto,
  ): Promise<MessageListResponse> {
    await this.ensureConversationExists(conversationId);
    await this.ensureConversationMember(conversationId, currentUserId);

    const limit = query.limit ?? 30;
    const messages = (await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: messageInclude,
    })) as MessageRecord[];

    const hasNextPage = messages.length > limit;
    const items = messages.slice(0, limit).map((message) => this.toMessageResponse(message));

    return {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? (items[items.length - 1]?.id ?? null) : null,
        hasNextPage,
      },
    };
  }

  async assertConversationMember(userId: string, conversationId: string): Promise<void> {
    await this.ensureConversationMember(conversationId, userId);
  }

  async sendTextMessage(
    currentUserId: string,
    dto: SendMessagePayloadDto,
  ): Promise<SendMessageResult> {
    await this.ensureConversationMember(dto.conversationId, currentUserId);

    const content = (dto.content ?? dto.text ?? '').trim();
    if (content.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Message text cannot be empty.',
      });
    }

    if (content.length > 2000) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Message text is too long.',
      });
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const client = tx as unknown as TransactionClient;
      const createdMessage = (await client.message.create({
        data: {
          conversationId: dto.conversationId,
          senderId: currentUserId,
          type: 'TEXT',
          text: content,
          content,
          mediaUrl: dto.mediaUrl,
        },
        include: messageInclude,
      })) as MessageRecord;

      await client.conversation.update({
        where: { id: dto.conversationId },
        data: {
          lastMessageId: createdMessage.id,
          updatedAt: createdMessage.createdAt,
        },
        select: { id: true },
      });

      return createdMessage;
    });

    await this.createMessageNotifications(currentUserId, dto.conversationId, message.id);

    return {
      clientTempId: dto.clientTempId,
      clientMessageId: dto.clientMessageId,
      message: this.toMessageResponse(message),
    };
  }

  async markSeen(currentUserId: string, dto: MarkSeenPayloadDto): Promise<MarkSeenResult> {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: dto.conversationId,
          userId: currentUserId,
        },
      },
      select: {
        id: true,
        lastSeenAt: true,
        lastSeenMessageId: true,
      },
    });

    if (!member) {
      throw new ForbiddenException({
        code: 'CHAT_FORBIDDEN',
        message: 'You are not a member of this conversation.',
      });
    }

    const message = await this.prisma.message.findFirst({
      where: {
        id: dto.messageId,
        conversationId: dto.conversationId,
        deletedAt: null,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        createdAt: true,
      },
    });

    if (!message) {
      throw new BadRequestException({
        code: 'CHAT_MESSAGE_NOT_IN_CONVERSATION',
        message: 'Message does not belong to this conversation.',
      });
    }

    if (message.senderId === currentUserId) {
      return {
        conversationId: dto.conversationId,
        userId: currentUserId,
        messageId: dto.messageId,
        seenAt: message.createdAt,
        skipped: true,
      };
    }

    if (member.lastSeenAt && message.createdAt <= member.lastSeenAt) {
      return {
        conversationId: dto.conversationId,
        userId: currentUserId,
        messageId: member.lastSeenMessageId ?? dto.messageId,
        seenAt: member.lastSeenAt,
      };
    }

    const updatedMember = await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: dto.conversationId,
          userId: currentUserId,
        },
      },
      data: {
        lastSeenMessageId: dto.messageId,
        lastSeenAt: message.createdAt,
      },
      select: {
        userId: true,
        conversationId: true,
        lastSeenMessageId: true,
        lastSeenAt: true,
      },
    });

    return {
      conversationId: updatedMember.conversationId,
      userId: updatedMember.userId,
      messageId: updatedMember.lastSeenMessageId ?? dto.messageId,
      seenAt: updatedMember.lastSeenAt ?? message.createdAt,
    };
  }

  async deleteMessage(
    currentUserId: string,
    conversationId: string,
    messageId: string,
  ): Promise<DeleteMessageResponse> {
    await this.ensureConversationExists(conversationId);
    await this.ensureConversationMember(conversationId, currentUserId);

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        deletedAt: true,
      },
    });

    if (!message) {
      throw new NotFoundException({
        code: 'CHAT_MESSAGE_NOT_FOUND',
        message: 'Message not found.',
      });
    }

    if (message.senderId !== currentUserId) {
      throw new ForbiddenException({
        code: 'CHAT_MESSAGE_FORBIDDEN',
        message: 'You are not allowed to delete this message.',
      });
    }

    if (message.deletedAt) {
      return {
        deleted: true,
        id: message.id,
        conversationId: message.conversationId,
        deletedAt: message.deletedAt,
      };
    }

    const deletedAt = new Date();
    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt },
      select: { id: true },
    });

    return {
      deleted: true,
      id: message.id,
      conversationId: message.conversationId,
      deletedAt,
    };
  }

  private async ensureTargetUserExists(targetUserId: string): Promise<void> {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        status: 'active',
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }
  }

  private async ensureConversationExists(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CHAT_CONVERSATION_NOT_FOUND',
        message: 'Conversation not found.',
      });
    }
  }

  private async ensureConversationMember(conversationId: string, userId: string): Promise<void> {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      throw new ForbiddenException({
        code: 'CHAT_FORBIDDEN',
        message: 'You are not a member of this conversation.',
      });
    }
  }

  private async toConversationResponse(
    conversation: ConversationRecord,
    currentUserId: string,
    inboxShape: boolean,
  ): Promise<ConversationResponseItem> {
    const currentMember = conversation.members.find((member) => member.userId === currentUserId);
    const unreadCount = await this.countUnreadMessages(
      conversation.id,
      currentUserId,
      currentMember,
    );

    return {
      id: conversation.id,
      type: conversation.type.toLowerCase(),
      members: this.toMembersResponse(conversation.members, currentUserId, inboxShape),
      lastMessage: conversation.messages?.[0]
        ? this.toMessageResponse(conversation.messages[0])
        : null,
      unreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private toMembersResponse(
    members: ConversationMemberRecord[],
    currentUserId: string,
    inboxShape: boolean,
  ): ConversationMemberResponse[] {
    return members
      .filter((member) => !inboxShape || member.userId !== currentUserId)
      .map((member) => ({
        user: member.user,
        joinedAt: member.joinedAt,
        lastSeenMessageId: member.lastSeenMessageId,
        lastSeenAt: member.lastSeenAt,
      }));
  }

  private toMessageResponse(message: MessageRecord): MessageResponseItem {
    const content = message.content ?? message.text ?? '';

    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender,
      type: message.type.toLowerCase(),
      content,
      text: message.text,
      mediaUrl: message.mediaUrl ?? null,
      deletedAt: message.deletedAt ?? null,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private async countUnreadMessages(
    conversationId: string,
    currentUserId: string,
    currentMember?: ConversationMemberRecord,
  ): Promise<number> {
    return this.prisma.message.count({
      where: {
        conversationId,
        senderId: {
          not: currentUserId,
        },
        deletedAt: null,
        ...(currentMember?.lastSeenAt
          ? {
              createdAt: {
                gt: currentMember.lastSeenAt,
              },
            }
          : {}),
      },
    });
  }

  private async createMessageNotifications(
    actorId: string,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const recipients = (await this.prisma.conversationMember.findMany({
      where: {
        conversationId,
        userId: {
          not: actorId,
        },
      },
      select: {
        userId: true,
      },
    })) as Array<{ userId: string }>;

    await Promise.all(
      recipients.map((recipient) =>
        this.notificationsService.createMessageNotification({
          actorId,
          recipientId: recipient.userId,
          conversationId,
          messageId,
        }),
      ),
    );
  }

  private buildDirectKey(firstUserId: string, secondUserId: string): string {
    return [firstUserId, secondUserId].sort().join(':');
  }

  private isPrismaUniqueConstraintError(
    error: unknown,
  ): error is { code: 'P2002'; meta?: { target?: unknown } } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
