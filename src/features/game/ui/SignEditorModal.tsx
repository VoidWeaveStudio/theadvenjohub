// src/features/game/ui/SignEditorModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Type, Pencil, Eraser } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { ColorPalette } from "./shell/ColorPalette";

interface SignEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    signId: string | null;
    onSubmitText: (signId: string, text: string) => Promise<void>;
    onSubmitDraw: (signId: string, blob: Blob) => Promise<void>;
    onNotification?: (msg: string, duration?: number) => void;
}

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 320;

export function SignEditorModal({ isOpen, onClose, signId, onSubmitText, onSubmitDraw, onNotification }: SignEditorModalProps) {
    const [mode, setMode] = useState<"choice" | "text" | "draw">("choice");
    const [text, setText] = useState("");
    const [color, setColor] = useState("#2b1c10");
    const [isSaving, setIsSaving] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setMode("choice");
            setText("");
        }
    }, [isOpen, signId]);

    useEffect(() => {
        if (mode !== "draw") return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, [mode]);

    if (!isOpen || !signId) return null;

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
            y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        isDrawingRef.current = true;
        lastPointRef.current = getPoint(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const last = lastPointRef.current;
        if (!ctx || !last) return;
        const point = getPoint(e);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPointRef.current = point;
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        lastPointRef.current = null;
    };

    const handleClearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleSaveText = async () => {
        const trimmed = text.trim();
        if (!trimmed || isSaving) return;
        setIsSaving(true);
        try {
            await onSubmitText(signId, trimmed);
            onClose();
        } catch (err) {
            onNotification?.(`⚠️ ${err instanceof Error ? err.message : "Failed to save the sign"}`, 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDrawing = async () => {
        const canvas = canvasRef.current;
        if (!canvas || isSaving) return;
        setIsSaving(true);
        try {
            const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
            if (!blob) {
                onNotification?.("⚠️ Could not export the drawing", 3000);
                return;
            }
            await onSubmitDraw(signId, blob);
            onClose();
        } catch (err) {
            onNotification?.(`⚠️ ${err instanceof Error ? err.message : "Failed to save the sign"}`, 3000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4">
            <div className="w-full max-w-md bg-[rgba(12,14,16,0.95)] border-2 border-[#4FD1FF]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(79,209,255,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-[#E5E7EB]">Sign Content</h2>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {mode === "choice" && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setMode("text")}
                            className="flex-1 flex flex-col items-center gap-2 bg-black/40 border border-zinc-700 hover:border-[#4FD1FF] rounded-lg py-6 transition-colors"
                        >
                            <Type className="w-6 h-6 text-[#4FD1FF]" />
                            <span className="text-sm font-bold text-[#E5E7EB]">Type Text</span>
                        </button>
                        <button
                            onClick={() => setMode("draw")}
                            className="flex-1 flex flex-col items-center gap-2 bg-black/40 border border-zinc-700 hover:border-[#4FD1FF] rounded-lg py-6 transition-colors"
                        >
                            <Pencil className="w-6 h-6 text-[#4FD1FF]" />
                            <span className="text-sm font-bold text-[#E5E7EB]">Draw</span>
                        </button>
                    </div>
                )}

                {mode === "text" && (
                    <>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value.slice(0, 150))}
                            placeholder="What does the sign say?"
                            rows={4}
                            autoFocus
                            className="w-full bg-black/40 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-[#4FD1FF] outline-none resize-none"
                        />
                        <p className="text-[#6B7280] text-xs mt-1">{text.length}/150</p>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => setMode("choice")}
                                className="flex-1 bg-black/40 border border-zinc-700 text-[#C5C9D1] font-bold px-4 py-2.5 rounded-[8px] transition-colors hover:border-zinc-500"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSaveText}
                                disabled={!text.trim() || isSaving}
                                className="flex-1 bg-gradient-to-r from-[#4FD1FF] to-[#3B9FD9] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2.5 rounded-[8px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </>
                )}

                {mode === "draw" && (
                    <>
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_WIDTH}
                            height={CANVAS_HEIGHT}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                            className="w-full rounded border border-zinc-700 touch-none cursor-crosshair"
                        />
                        <div className="flex items-center gap-2 mt-3">
                            <ColorPalette color={color} onChange={setColor} />
                            <button
                                onClick={handleClearCanvas}
                                className="ml-auto flex items-center gap-1 text-[#8B8F98] hover:text-[#E5E7EB] text-xs transition-colors flex-shrink-0"
                            >
                                <Eraser className="w-3.5 h-3.5" />
                                Clear
                            </button>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => setMode("choice")}
                                className="flex-1 bg-black/40 border border-zinc-700 text-[#C5C9D1] font-bold px-4 py-2.5 rounded-[8px] transition-colors hover:border-zinc-500"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSaveDrawing}
                                disabled={isSaving}
                                className="flex-1 bg-gradient-to-r from-[#4FD1FF] to-[#3B9FD9] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2.5 rounded-[8px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
