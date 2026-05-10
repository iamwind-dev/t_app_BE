import { PublicUserProfile } from '../../users/types/user-profile.type';

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

export interface FollowListPageInfo {
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface FollowListPage {
  items: FollowListItemProfile[];
  pageInfo: FollowListPageInfo;
}

export interface FollowActionResponse {
  user: PublicUserProfile;
}
