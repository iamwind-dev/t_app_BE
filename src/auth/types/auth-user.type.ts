export interface PublicAuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: PublicAuthUser;
  accessToken: string;
}
