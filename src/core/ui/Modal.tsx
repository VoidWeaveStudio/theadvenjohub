//src\core\ui\Modal.tsx
"use client";

import { ReactNode, useEffect } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-xl lg:max-w-2xl",
    lg: "sm:max-w-2xl lg:max-w-4xl",
    xl: "sm:max-w-3xl lg:max-w-6xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className={`relative w-full ${sizeClasses[size]} bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col transition-transform duration-200 ease-out`}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground line-clamp-1 pr-4">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-foreground transition-colors text-xl min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg active:scale-95 touch-manipulation"
            aria-label={t("modal.close")}
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {children}
        </div>
      </div>
    </div>
  );
}