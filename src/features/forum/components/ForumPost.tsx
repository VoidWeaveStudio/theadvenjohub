// src/features/forum/components/ForumPost.tsx
"use client";

import { sanitizeInput } from "@/core/lib/sanitize";
import { formatDate, getAuthorName } from "@/core/lib/clientUtils";
import { useLanguage } from "@/core/i18n/LanguageContext";

export interface PostWithUser {
  id: string;
  title: string;
  content: string;
  category: string;
  commentsCount: number;
  createdAt: string;
  user: {
    id: string;
    wallet: string;
    nickname: string | null;
  } | null;
}

interface ForumPostProps {
  post: PostWithUser;
  onClick: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "bug-report": "bg-red-500/10 text-red-400 border-red-500/30",
  suggestion: "bg-green-500/10 text-green-400 border-green-500/30",
  discussion: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

export function ForumPost({ post, onClick }: ForumPostProps) {
  const { t } = useLanguage();
  return (
    <article
      className="card p-5 border-border hover:border-primary/50 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${CATEGORY_COLORS[post.category] || CATEGORY_COLORS.general}`}>
              {sanitizeInput(post.category).replace("-", " ")}
            </span>
          </div>

          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {sanitizeInput(post.title)}
          </h3>

          <p className="text-sm text-text-secondary mt-2 line-clamp-2">
            {sanitizeInput(post.content)}
          </p>

          <div className="flex items-center gap-4 mt-4 text-sm">
            <span className="text-text-muted">
              {t("forum.postBy")} {sanitizeInput(getAuthorName(post.user?.wallet))}
            </span>

            <div className="flex items-center gap-3 ml-auto">
              <span className="flex items-center gap-1 text-text-muted">
                <span>💬</span>
                <span>{post.commentsCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default ForumPost;