// src/features/game/ui/preview/ModelPreview.tsx
"use client";

import { useEffect, useRef } from "react";
import { ResourceManager } from "../../core/ResourceManager";
import { PreviewScene, type PreviewSubject } from "./PreviewScene";

interface ModelPreviewProps {
    subject: PreviewSubject;
    className?: string;
}

export function ModelPreview({ subject, className }: ModelPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sceneRef = useRef<PreviewScene | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const scene = new PreviewScene(canvas, ResourceManager.getInstance());
        sceneRef.current = scene;

        const onResize = () => scene.resize();
        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("resize", onResize);
            scene.dispose();
            sceneRef.current = null;
        };
    }, []);

    useEffect(() => {
        sceneRef.current?.setSubject(subject);
        sceneRef.current?.resize();
    }, [
        subject.kind,
        subject.kind === "companion" ? subject.companionId : null,
        subject.kind === "character" ? subject.skinId : null,
        subject.kind === "character" ? subject.accessoryId : null,
    ]);

    return (
        <canvas
            ref={canvasRef}
            className={className ?? "w-full h-full block cursor-grab active:cursor-grabbing"}
        />
    );
}
