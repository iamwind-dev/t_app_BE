export interface FollowListItemProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followedAt: Date;
}

export interface UserFollowsPage {
  items: FollowListItemProfile[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

