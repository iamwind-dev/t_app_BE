import { useMemo, useState } from 'react';
import { FeedPostItem, ModerationResult } from './types/moderation';
import { FeedPost } from './components/FeedPost';
import { ModerationWarningModal } from './components/ModerationWarningModal';
import { PostComposer } from './components/PostComposer';

interface PendingPost {
  content: string;
  moderation: ModerationResult;
}

export function App(): JSX.Element {
  const [feed, setFeed] = useState<FeedPostItem[]>([]);
  const [pending, setPending] = useState<PendingPost | null>(null);

  const orderedFeed = useMemo(
    () => [...feed].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [feed],
  );

  const submitPost = (content: string, moderation: ModerationResult) => {
    const item: FeedPostItem = {
      id: crypto.randomUUID(),
      content,
      moderation,
      createdAt: new Date().toISOString(),
    };
    setFeed((prev) => [item, ...prev]);
  };

  const handleNeedConfirm = (content: string, moderation: ModerationResult) => {
    setPending({ content, moderation });
  };

  const handleEdit = () => setPending(null);
  const handlePostAnyway = () => {
    if (!pending) return;
    submitPost(pending.content, pending.moderation);
    setPending(null);
  };

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <h1>Threads AI Moderation Demo</h1>
          <p>Soft moderation: detect {'->'} warn {'->'} blur {'->'} user keeps control.</p>
        </header>

        <PostComposer onSubmit={submitPost} onNeedConfirm={handleNeedConfirm} />

        <section className="feed">
          <h2>Feed preview</h2>
          {orderedFeed.length === 0 ? (
            <div className="card empty-feed">Chua co bai post nao.</div>
          ) : (
            orderedFeed.map((post) => <FeedPost key={post.id} post={post} />)
          )}
        </section>
      </div>

      <ModerationWarningModal
        open={Boolean(pending)}
        onEdit={handleEdit}
        onPostAnyway={handlePostAnyway}
      />
    </div>
  );
}
