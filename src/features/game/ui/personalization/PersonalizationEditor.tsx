// src/features/game/ui/personalization/PersonalizationEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Palette, RotateCcw, Loader2 } from "lucide-react";
import { ResourceManager } from "../../core/ResourceManager";
import { PaintEditorScene } from "./PaintEditorScene";
import { SoundManager } from "../../core/SoundManager";
import { ColorPalette } from "../shell/ColorPalette";

interface PersonalizationEditorProps {
    isOpen: boolean;
    onClose: () => void;
    currentSkinUrl: string | null;
    onSave: (blob: Blob) => Promise<void>;
    onNotification?: (msg: string, duration?: number) => void;
}

export function PersonalizationEditor({ isOpen, onClose, currentSkinUrl, onSave, onNotification }: PersonalizationEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<PaintEditorScene | null>(null);
    const [brushSize, setBrushSize] = useState(24);
    const [color, setColor] = useState("#ef4444");
    const [isSaving, setIsSaving] = useState(false);

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;

        const scene = new PaintEditorScene(canvasRef.current, ResourceManager.getInstance());
        sceneRef.current = scene;
        if (currentSkinUrl) {
            scene.loadExistingTexture(currentSkinUrl);
        }

        const handleResize = () => scene.resize();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            scene.dispose();
            sceneRef.current = null;
        };
    }, [isOpen]);

    useEffect(() => {
        sceneRef.current?.setBrushSize(brushSize);
    }, [brushSize]);

    useEffect(() => {
        sceneRef.current?.setColor(color);
    }, [color]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!sceneRef.current || isSaving) return;
        setIsSaving(true);
        try {
            const blob = await sceneRef.current.exportPNGBlob();
            if (!blob) {
                onNotification?.("⚠️ Could not export the painted texture", 3000);
                return;
            }
            await onSave(blob);
            onClose();
        } catch (err) {
            const expired = err instanceof Error && err.message === "session_expired";
            onNotification?.(
                expired
                    ? "🔒 Session expired — your paint job is still here, hit Save again"
                    : "⚠️ Could not save — your paint job is still here, hit Save again",
                4500
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.92)] flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="w-full max-w-4xl h-[80vh] bg-[rgba(10,16,20,0.97)] border-2 border-[#4FC3FF]/40 rounded-[16px] shadow-[0_0_35px_rgba(79,195,255,0.15)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-[#4FC3FF]" />
                        <h2 className="text-lg font-black text-[#E5E7EB]">Personalization</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 flex">
                    <div className="flex-1 relative">
                        <canvas ref={canvasRef} className="w-full h-full block" />
                        <div className="absolute bottom-3 left-3 text-[#6B7280] text-[11px]">
                            Left-click drag to paint · Right-click drag to rotate · Scroll to zoom
                        </div>
                    </div>

                    <div className="w-56 flex-shrink-0 border-l border-white/10 p-4 space-y-5 overflow-y-auto">
                        <div>
                            <label className="text-[#8B8F98] text-xs font-bold tracking-wider">BRUSH SIZE</label>
                            <input
                                type="range"
                                min={4}
                                max={80}
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                className="w-full mt-2"
                            />
                            <div className="text-[#4FC3FF] text-xs font-bold text-right">{brushSize}px</div>
                        </div>

                        <div>
                            <label className="text-[#8B8F98] text-xs font-bold tracking-wider">COLOR</label>
                            <div className="mt-2">
                                <ColorPalette color={color} onChange={setColor} />
                            </div>
                        </div>

                        <button
                            onClick={() => sceneRef.current?.resetToBlank()}
                            className="w-full flex items-center justify-center gap-1.5 bg-transparent border border-white/10 hover:border-white/30 text-[#8B8F98] hover:text-[#E5E7EB] px-3 py-2 rounded-[8px] text-xs font-bold transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset to White
                        </button>

                        <div className="pt-2 space-y-2">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#4FC3FF] to-[#3B9FD9] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2.5 rounded-[8px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                                onClick={onClose}
                                disabled={isSaving}
                                className="w-full bg-transparent border-0 text-[#8B8F98] hover:text-[#E5E7EB] px-4 py-2 rounded-[8px] text-sm transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
