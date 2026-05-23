import { ModerationResult } from '../../modules/moderation/interfaces/moderation-result.interface';

export interface ReelResponseItem {
  id: string;
  caption: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  audioTitle: string | null;
  durationSeconds: number | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  moderationStatus: string;
  moderationLabel: string | null;
  moderationConfidence: number | null;
  moderationAction: string | null;
  moderationIsWarning: boolean;
  visibilityLevel: string;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  isLikedByMe: boolean;
}

export interface ReelResponse {
  reel: ReelResponseItem;
  moderation?: ModerationResult;
}

export interface ReelFeedResponse {
  items: ReelResponseItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface DeleteReelResponse {
  deleted: true;
  id: string;
  deletedAt: Date;
}

export interface ReelReactionResponse {
  reelId: string;
  likeCount: number;
  isLiked: boolean;
}

export interface ReelCommentResponseItem {
  id: string;
  reelId: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  content: string;
  likeCount: number;
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

export interface ReelCommentResponse {
  comment: ReelCommentResponseItem;
  moderation?: ModerationResult;
}

export interface ReelCommentListResponse {
  items: ReelCommentResponseItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}
