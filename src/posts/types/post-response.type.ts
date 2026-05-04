export interface PostResponseItem {
  id: string;
  content: string | null;
  mediaUrls: string[];
  moderationStatus: string;
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
