// src/features/forum/components/ForumContent.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ForumPost, type PostWithUser } from "./ForumPost";
import { CreatePostModal } from "./CreatePostModal";
import { PostModal } from "@/features/forum/components/PostModal";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { Spinner } from "@/core/ui/Spinner";
import { useAuth } from "@/core/auth/AuthProvider";

interface ForumPost {
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
  };
}

const CATEGORIES = [
  { id: "all", label: "categories.all" },
  { id: "general", label: "categories.general" },
  { id: "bug-report", label: "categories.bug-report" },
  { id: "suggestion", label: "categories.suggestion" },
  { id: "discussion", label: "categories.discussion" },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

export default function ForumContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthorized, isLoading: isAuthLoading } = useAuth();

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPosts = useCallback(async (cursor?: string | null, category?: CategoryId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "20",
        ...(category && category !== "all" && { category }),
        ...(cursor && { cursor }),
      });

      const res = await fetch(`/api/forum/posts?${params}`, {
        credentials: "include",
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        if (res.status === 500) {
          await new Promise(resolve => setTimeout(resolve, 300));
          return fetchPosts(cursor, category);
        }
        throw new Error("Failed to fetch posts");
      }

      const data = await res.json();

      if (cursor) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setNextCursor(data.nextCursor);
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Fetch posts error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPosts(undefined, selectedCategory);
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedCategory, fetchPosts]);

  const handleLoadMore = useCallback(() => {
    if (nextCursor && !isLoading) {
      fetchPosts(nextCursor, selectedCategory);
    }
  }, [nextCursor, isLoading, selectedCategory, fetchPosts]);

  const handlePostCreated = (newPost: ForumPost) => {
    setPosts(prev => [newPost, ...prev]);
    setShowCreateModal(false);
  };

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all ${selectedCategory === cat.id
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-text-secondary hover:text-foreground hover:bg-surface/50 border border-transparent"
                }`}
            >
              {t(cat.label)}
            </button>
          ))}
        </div>

        {isAuthorized ? (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            {t("forum.newPost")}
          </button>
        ) : (
          <button
            onClick={() => router.push("/profile?tab=settings")}
            className="btn-secondary px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            {t("forum.connectWallet")}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {isLoading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : posts.length === 0 ? (
          <div className="card p-8 text-center text-text-secondary">
            <p className="text-lg mb-2">{t("forum.noPosts")}</p>
            <p className="text-sm">{t("forum.beFirst")}</p>
          </div>
        ) : (
          posts.map(post => (
            <ForumPost
              key={post.id}
              post={post}
              onClick={() => setSelectedPostId(post.id)}
            />
          ))
        )}
      </div>

      {nextCursor && !isLoading && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            className="btn-secondary px-6 py-2 text-sm font-medium"
          >
            {t("forum.loadMore")}
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handlePostCreated}
        />
      )}

      {selectedPostId && (
        <PostModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </div>
  );
}