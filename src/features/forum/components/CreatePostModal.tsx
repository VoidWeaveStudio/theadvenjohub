//src\features\forum\components\CreatePostModal.tsx
"use client";

import { useState } from "react";
import { Modal } from "@/core/ui/Modal";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { apiPost } from "@/core/api/client";

interface CreatePostModalProps {
  onClose: () => void;
  onSuccess: (post: any) => void;
}

const CATEGORIES = [
  { id: "general", label: "categories.general" },
  { id: "bug-report", label: "categories.bug-report" },
  { id: "suggestion", label: "categories.suggestion" },
  { id: "discussion", label: "categories.discussion" },
] as const;

export function CreatePostModal({ onClose, onSuccess }: CreatePostModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]["id"]>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (title.trim().length < 3) {
      setError(t("modal.titleMin"));
      return;
    }
    if (content.trim().length < 10) {
      setError(t("modal.contentMin"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const data = await apiPost<{ post: any }>("/api/forum/posts", {
        title: title.trim(),
        content: content.trim(),
        category
      });

      onSuccess(data.post);
    } catch (err: any) {
      setError(err.message || t("modal.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t("modal.createPost")}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t("modal.category")}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="input-field w-full"
            disabled={isSubmitting}
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>
                {t(cat.label)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t("modal.title")}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("modal.titlePlaceholder")}
            className="input-field w-full"
            maxLength={200}
            disabled={isSubmitting}
          />
          <p className="text-xs text-text-muted mt-1 text-right">
            {title.length}/200
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t("modal.content")}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("modal.contentPlaceholder")}
            className="input-field w-full min-h-[150px] resize-y"
            maxLength={10000}
            disabled={isSubmitting}
          />
          <p className="text-xs text-text-muted mt-1 text-right">
            {content.length}/10000
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-4 py-2"
            disabled={isSubmitting}
          >
            {t("modal.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            className="btn-primary px-6 py-2 disabled:opacity-50"
          >
            {isSubmitting ? t("modal.creating") : t("modal.create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export default CreatePostModal;