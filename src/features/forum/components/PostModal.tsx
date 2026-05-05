// src/features/forum/components/PostModal.tsx
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Modal } from "@/core/ui/Modal";
import { sanitizeInput, sanitizeRichText } from "@/core/lib/sanitize";
import { shortId } from "@/core/lib/shortId";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { formatDateTime, getAuthorName } from "@/core/lib/clientUtils";
import { apiGet, apiPost } from "@/core/api/client";
import { Spinner } from "@/core/ui/Spinner";

interface PostUser {
  id: string;
  wallet: string;
  nickname: string | null;
}

interface ForumPost {
  id: string;
  title: string;
  content: string;
  category: string;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  user: PostUser;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: PostUser;
}

interface PostModalProps {
  postId: string;
  onClose: () => void;
}

export function PostModal({ postId, onClose }: PostModalProps) {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { t } = useLanguage();

  const [post, setPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await apiGet("/api/auth/me");
        setIsAuth(!!publicKey);
      } catch {
        setIsAuth(!!publicKey);
      }
    };
    checkAuth();
  }, [publicKey]);

  useEffect(() => {
    if (!postId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await apiGet<{ post: ForumPost; comments: Comment[] }>(`/api/forum/posts/${postId}`);
        setPost(data.post);
        setComments(data.comments || []);
      } catch {
        setError(t("post.networkError"));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [postId, t]);

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAuth || !commentText.trim() || !postId) return;

    setIsSubmitting(true);
    try {
      await apiPost(`/api/forum/posts/${postId}/comments`, {
        content: sanitizeInput(commentText.trim())
      });
      setCommentText("");
      const data = await apiGet<{ comments: Comment[] }>(`/api/forum/posts/${postId}`);
      setComments(data.comments || []);
    } catch (err: any) {
      setError(err.message || t("post.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewContent = post?.content && post.content.length > 500 && !expanded
    ? post.content.slice(0, 500) + "..."
    : post?.content;

  if (isLoading) {
    return (
      <Modal isOpen={true} onClose={onClose} title={t("post.loading")} size="lg">
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      </Modal>
    );
  }

  if (error || !post) {
    return (
      <Modal isOpen={true} onClose={onClose} title={t("post.error")} size="lg">
        <div className="text-center py-8">
          <p className="text-text-secondary mb-4">{error || t("post.notFound")}</p>
          <button onClick={onClose} className="btn-primary px-4 py-2">{t("common.close")}</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="" size="lg">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
        <article className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="px-2 py-1 text-xs font-medium rounded bg-primary/10 text-primary border border-primary/20 capitalize">
                  {sanitizeInput(post.category).replace("-", " ")}
                </span>
                <span className="text-xs text-text-muted">#{shortId(post.id)}</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {sanitizeInput(post.title)}
              </h2>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-foreground text-2xl leading-none">&times;</button>
          </div>

          <div className="flex items-center gap-3 text-sm text-text-muted">
            <span>{t("post.by")} {sanitizeInput(getAuthorName(post.user?.wallet))}</span>
            <span>•</span>
          </div>

          <div className="prose prose-invert max-w-none text-text-secondary leading-relaxed whitespace-pre-wrap">
            {sanitizeRichText(previewContent || "")}
          </div>

          {post.content && post.content.length > 500 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-primary hover:underline text-sm font-medium"
            >
              {expanded ? t("post.collapse") : t("post.readMore")}
            </button>
          )}

          <div className="flex items-center gap-4 pt-4 border-t border-border">
            <span className="text-sm text-text-muted">
              💬 {post.commentsCount} {t("post.comments")}
            </span>
          </div>
        </article>

        <section className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-lg font-semibold text-foreground">{t("post.commentsCount")}</h3>

          {isAuth ? (
            <form onSubmit={handleAddComment} className="space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t("post.writeComment")}
                className="input-field min-h-[80px] resize-y"
                maxLength={2000}
                required
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-text-muted">{commentText.length}/2000</p>
                <button
                  type="submit"
                  disabled={isSubmitting || !commentText.trim()}
                  className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {isSubmitting ? t("post.posting") : t("post.postComment")}
                </button>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </form>
          ) : (
            <div className="p-4 bg-surface/50 rounded-lg border border-border text-center text-sm text-text-secondary">
              <button
                onClick={() => { onClose(); router.push("/profile?tab=settings"); }}
                className="text-primary hover:underline font-medium"
              >
                {t("post.connectToComment")}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-center text-text-secondary py-4">{t("post.noComments")}</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="p-4 bg-surface/50 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {sanitizeInput(getAuthorName(c.user?.wallet))}
                      </span>
                      <span className="text-text-muted">• {formatDateTime(c.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                    {sanitizeInput(c.content)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default PostModal;