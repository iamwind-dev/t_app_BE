export interface ReplyResponseItem {
  id: string;
  postId: string;
  parentReplyId: string | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  content: string | null;
  mediaUrls: string[];
  likeCount: number;
  childReplyCount: number;
  moderationStatus: string;
  createdAt: Date;
  isLikedByMe: boolean;
}

export interface ReplyResponse {
  reply: ReplyResponseItem;
}

export interface ReplyListResponse {
  items: ReplyResponseItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}
