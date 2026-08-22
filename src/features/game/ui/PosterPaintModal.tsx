// src/features/game/ui/PosterPaintModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Eraser, Paintbrush, Undo2 } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { ColorPalette } from "./shell/ColorPalette";
import { canvasToPngBlob } from "../utils/exportPng";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface PosterPaintModalProps {
    isOpen: boolean;
    aspect?: number | null;
    sourceUrl?: string | null;
    onClose: () => void;
    onSubmit: (image: Blob) => Promise<void>;
    onNotification?: (msg: string, duration?: number) => void;
}

const CANVAS_LONG_EDGE = 768;
const BRUSH_SIZES = [3, 8, 18, 34];
const BACKGROUNDS = ["#FFFFFF", "#0F172A", "#FDE68A", "#DCFCE7", "#E0E7FF"];
const HISTORY_LIMIT = 12;

function canvasSize(aspect: number): { width: number; height: number } {
    if (aspect >= 1) {
        return { width: CANVAS_LONG_EDGE, height: Math.round(CANVAS_LONG_EDGE / aspect) };
    }
    return { width: Math.round(CANVAS_LONG_EDGE * aspect), height: CANVAS_LONG_EDGE };
}

export function PosterPaintModal({
    isOpen,
    aspect,
    sourceUrl,
    onClose,
    onSubmit,
    onNotification,
}: PosterPaintModalProps) {
    const { t } = useLanguage();
    const [color, setColor] = useState("#1f2937");
    const [brush, setBrush] = useState(8);
    const [erasing, setErasing] = useState(false);
    const [background, setBackground] = useState("#FFFFFF");
    const [isSaving, setIsSaving] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const historyRef = useRef<ImageData[]>([]);
    const wasOpenRef = useRef(false);

    const ratio = aspect && aspect > 0.1 ? aspect : 1.45;
    const { width, height } = canvasSize(ratio);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play("modal-open");
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return;

        historyRef.current = [];
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!sourceUrl) return;

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            const current = canvasRef.current?.getContext("2d");
            if (!current) return;
            current.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        image.src = sourceUrl;
    }, [isOpen, sourceUrl, width, height]);

    if (!isOpen) return null;

    const pushHistory = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return;

        historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    };

    const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * width,
            y: ((event.clientY - rect.top) / rect.height) * height,
        };
    };

    const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        ctx.strokeStyle = erasing ? background : color;
        ctx.lineWidth = erasing ? brush * 2 : brush;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pushHistory();
        isDrawingRef.current = true;

        const point = getPoint(event);
        lastPointRef.current = point;
        stroke(point, { x: point.x + 0.01, y: point.y });
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        const last = lastPointRef.current;
        if (!last) return;

        const point = getPoint(event);
        stroke(last, point);
        lastPointRef.current = point;
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        lastPointRef.current = null;
    };

    const handleUndo = () => {
        const snapshot = historyRef.current.pop();
        const ctx = canvasRef.current?.getContext("2d");
        if (!snapshot || !ctx) return;
        ctx.putImageData(snapshot, 0, 0);
    };

    const handleFill = (next: string) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        pushHistory();
        setBackground(next);
        ctx.fillStyle = next;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas || isSaving) return;

        setIsSaving(true);
        try {
            const blob = await canvasToPngBlob(canvas);
            if (!blob) {
                onNotification?.("⚠️ Could not export the drawing", 3000);
                return;
            }
            await onSubmit(blob);
            onClose();
        } catch (err) {
            onNotification?.(`⚠️ ${err instanceof Error ? t(err.message) : t("g.poster.saveFailed")}`, 3000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-[60] pointer-events-auto p-2 sm:p-4 font-oxanium">
            <div className="w-full max-w-2xl bg-[rgba(12,14,16,0.95)] border-2 border-[#4FD1FF]/40 rounded-[16px] p-5 shadow-[0_0_35px_rgba(79,209,255,0.15)]">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-black text-[#E5E7EB] flex items-center gap-2">
                        <Paintbrush className="w-5 h-5 text-[#4FD1FF]" /> {t("g.poster.paintTitle")}
                    </h2>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex justify-center">
                    <canvas
                        ref={canvasRef}
                        width={width}
                        height={height}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        className="max-h-[46dvh] max-w-full rounded border border-zinc-700 touch-none cursor-crosshair bg-white"
                        style={{ aspectRatio: `${width} / ${height}` }}
                    />
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <ColorPalette color={color} onChange={(next) => { setColor(next); setErasing(false); }} />

                    <div className="flex items-center gap-1">
                        {BRUSH_SIZES.map((size) => (
                            <button
                                key={size}
                                onClick={() => setBrush(size)}
                                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${brush === size ? "bg-[#4FD1FF]/20" : "bg-white/5 hover:bg-white/10"}`}
                            >
                                <span
                                    className="rounded-full bg-[#E5E7EB] block"
                                    style={{ width: Math.max(4, size / 2.4), height: Math.max(4, size / 2.4) }}
                                />
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setErasing((active) => !active)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${erasing ? "bg-[#FFD166]/20 text-[#FFD166]" : "bg-white/5 text-[#8B8F98] hover:text-[#E5E7EB]"}`}
                    >
                        <Eraser className="w-3.5 h-3.5" /> {t("g.poster.eraser")}
                    </button>

                    <button
                        onClick={handleUndo}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-white/5 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors"
                    >
                        <Undo2 className="w-3.5 h-3.5" /> Undo
                    </button>

                    <div className="flex items-center gap-1 ml-auto">
                        {BACKGROUNDS.map((tone) => (
                            <button
                                key={tone}
                                onClick={() => handleFill(tone)}
                                title={t("g.poster.fillCanvas")}
                                className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 ${background === tone ? "border-[#4FD1FF]" : "border-white/15"}`}
                                style={{ background: tone }}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-black/40 border border-zinc-700 text-[#C5C9D1] font-bold px-4 py-2.5 rounded-[8px] transition-colors hover:border-zinc-500"
                    >
                        {t("g.poster.cancel")}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 bg-gradient-to-r from-[#4FD1FF] to-[#3B9FD9] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2.5 rounded-[8px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? t("g.sign.saving") : t("g.poster.hangUp")}
                    </button>
                </div>
            </div>
        </div>
    );
}
