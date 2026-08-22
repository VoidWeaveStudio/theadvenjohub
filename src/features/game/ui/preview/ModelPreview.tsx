// src/features/game/ui/preview/ModelPreview.tsx
"use client";

import { useEffect, useRef } from "react";
import { PreviewTile, type PreviewSubject } from "./PreviewScene";

interface ModelPreviewProps {
    subject: PreviewSubject;
    className?: string;
    interactive?: boolean;
}

export function ModelPreview({ subject, className, interactive = true }: ModelPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const tileRef = useRef<PreviewTile | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const tile = new PreviewTile(canvas, interactive);
        tileRef.current = tile;

        // Tiles that scrolled out of the list stop costing frames. Without this a
        // long shop list would keep every preview spinning off-screen.
        const observer = new IntersectionObserver(
            (entries) => tile.setVisible(entries.some((entry) => entry.isIntersecting)),
            { threshold: 0.01 }
        );
        observer.observe(canvas);

        return () => {
            observer.disconnect();
            tile.dispose();
            tileRef.current = null;
        };
    }, [interactive]);

    useEffect(() => {
        tileRef.current?.setSubject(subject);
    }, [
        subject.kind,
        subject.kind === "companion" ? subject.companionId : null,
        subject.kind === "character" ? subject.skinId : null,
        subject.kind === "character" ? subject.accessoryId : null,
        subject.kind === "character" ? subject.skinTextureUrl ?? null : null,
    ]);

    return (
        <canvas
            ref={canvasRef}
            className={className ?? `block h-full w-full ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
        />
    );
}
