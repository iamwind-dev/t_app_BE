export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  postCount: number;
  isFollowing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPostItem {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  content: string | null;
  mediaUrls: string[];
  replyCount: number;
  reactionCount: number;
  moderationStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPostsPage {
  items: UserPostItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}
