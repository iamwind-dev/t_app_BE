import { ModerationResult } from '../../modules/moderation/interfaces/moderation-result.interface';

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
  moderationLabel: string | null;
  moderationConfidence: number | null;
  moderationAction: string | null;
  moderationIsWarning: boolean;
  moderationModel: string | null;
  aiReviewedAt: Date | null;
  createdAt: Date;
  isLikedByMe: boolean;
}

export interface ReplyResponse {
  reply: ReplyResponseItem;
  moderation?: ModerationResult;
}

export interface ReplyListResponse {
  items: ReplyResponseItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface DeleteReplyResponse {
  deleted: true;
  id: string;
  deletedAt: Date;
}
