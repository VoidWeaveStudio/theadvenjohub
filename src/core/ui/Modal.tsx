// src/core/ui/Modal.tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const sizeClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md lg:max-w-lg",
    lg: "sm:max-w-2xl lg:max-w-4xl",
    xl: "sm:max-w-3xl lg:max-w-6xl",
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div
        className={`relative w-full ${sizeClasses[size]} bg-surface border border-border rounded-xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground line-clamp-1 pr-4">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-foreground transition-colors rounded-lg hover:bg-surface/50 active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label={t("modal.close")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12-12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}