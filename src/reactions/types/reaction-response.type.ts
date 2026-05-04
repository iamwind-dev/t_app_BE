export interface PostReactionResponse {
  postId: string;
  likeCount: number;
  isLiked: boolean;
}

export interface ReplyReactionResponse {
  replyId: string;
  likeCount: number;
  isLiked: boolean;
}
