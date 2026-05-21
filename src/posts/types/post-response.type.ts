import { ModerationResult } from '../../modules/moderation/interfaces/moderation-result.interface';

export interface PostResponseItem {
  id: string;
  content: string | null;
  mediaUrls: string[];
  moderationStatus: string;
  moderationLabel: string | null;
  moderationConfidence: number | null;
  moderationAction: string | null;
  moderationIsWarning: boolean;
  visibilityLevel: string;
  toxicityScore: number | null;
  moderationCategories: string[];
  moderationMessage: string | null;
  moderationHighlights: unknown;
  moderationSuggestion: string | null;
  moderationModel: string | null;
  aiReviewedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  likeCount: number;
  replyCount: number;
  isLikedByMe: boolean;
}

export interface PostResponse {
  post: PostResponseItem;
  moderation?: ModerationResult;
}

export interface FeedResponse {
  items: PostResponseItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface DeletePostResponse {
  deleted: true;
  id: string;
  deletedAt: Date;
}
