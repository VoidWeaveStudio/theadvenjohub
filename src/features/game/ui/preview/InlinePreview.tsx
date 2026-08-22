// src/features/game/ui/preview/InlinePreview.tsx
"use client";

import { ModelPreview } from "./ModelPreview";
import type { PreviewSubject } from "./PreviewScene";

interface InlinePreviewProps {
    subject: PreviewSubject;
    accent?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_CLASSES = {
    sm: "h-24 w-20",
    md: "h-32 w-28",
    lg: "h-44 w-36",
} as const;

// The thumbnail that sits inside a shop or roster card. Same renderer pool as
// the full-screen preview, just framed small and without its own controls.
export function InlinePreview({ subject, accent = "#4FD1FF", size = "md", className }: InlinePreviewProps) {
    return (
        <div
            className={`flex-shrink-0 overflow-hidden rounded-lg border border-white/10 ${SIZE_CLASSES[size]} ${className ?? ""}`}
            style={{ background: `radial-gradient(circle at 50% 18%, ${accent}26 -10%, rgba(0,0,0,0.5) 72%)` }}
        >
            <ModelPreview subject={subject} />
        </div>
    );
}
