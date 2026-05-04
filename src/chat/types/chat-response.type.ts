export interface ChatUserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ConversationMemberResponse {
  user: ChatUserSummary;
  joinedAt: Date;
  lastSeenMessageId: string | null;
  lastSeenAt: Date | null;
}

export interface MessageResponseItem {
  id: string;
  conversationId: string;
  sender: ChatUserSummary;
  type: string;
  content: string;
  text: string | null;
  mediaUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationResponseItem {
  id: string;
  type: string;
  members: ConversationMemberResponse[];
  lastMessage: MessageResponseItem | null;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationResponse {
  conversation: ConversationResponseItem;
}

export interface DirectConversationResult extends ConversationResponse {
  created: boolean;
}

export interface ConversationListResponse {
  items: ConversationResponseItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface MessageListResponse {
  items: MessageResponseItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface SendMessageResult {
  clientTempId?: string;
  clientMessageId?: string;
  message: MessageResponseItem;
}

export interface MarkSeenResult {
  conversationId: string;
  userId: string;
  messageId: string;
  seenAt: Date;
  skipped?: boolean;
}
