import { FeedPostItem } from '../types/moderation';
import { BlurredContent } from './BlurredContent';
import { ModerationStatusChip } from './ModerationStatusChip';

interface Props {
  post: FeedPostItem;
}

export function FeedPost({ post }: Props): JSX.Element {
  const { moderation } = post;
  return (
    <article className="card feed-post">
      <div className="feed-head">
        <strong>@demo_user</strong>
        <ModerationStatusChip label={moderation.label} />
      </div>
      {moderation.shouldBlurContent ? (
        <BlurredContent
          content={post.content}
          warningText={moderation.moderationDisplayText}
        />
      ) : (
        <p className="feed-content">{post.content}</p>
      )}
      <p className="meta">
        {new Date(post.createdAt).toLocaleTimeString()} • score {Math.round(
          moderation.toxicityScore * 100,
        )}
        %
      </p>
    </article>
  );
}
