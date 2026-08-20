// src/core/ui/Spinner.tsx
"use client";

import React from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const { t } = useLanguage();

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16",
  };

  return (
    <div 
      className={`${sizeClasses[size]} animate-spin animate-pulse ${className}`}
      role="status"
      aria-label={t("common.loading")}
    >
      <img
        src="/logo-spinner.png"
        alt={t("common.loading")}
        className="w-full h-full object-contain animate-shimmer"
        draggable={false}
      />
    </div>
  );
}