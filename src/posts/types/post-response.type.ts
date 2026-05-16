export interface PostResponseItem {
  id: string;
  content: string | null;
  mediaUrls: string[];
  moderationStatus: string;
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
  moderation?: {
    label: string;
    toxicityScore: number;
    categories: string[];
    message: string;
    highlights: unknown[];
    suggestion: string;
    model: string;
    visibilityLevel: string;
  };
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
