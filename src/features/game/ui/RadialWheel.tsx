// src/features/game/ui/RadialWheel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SoundManager } from "../core/SoundManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

export interface WheelItem {
    id: string;
    label: string;
    emoji: string;
    accent: string;
    hint?: string;
    locked?: boolean;
    lockReason?: string;
}

export interface WheelPage {
    id: string;
    label: string;
    items: WheelItem[];
}

interface RadialWheelProps {
    isOpen: boolean;
    pages: WheelPage[];
    onSelect: (pageId: string, itemId: string) => void;
    onClose: () => void;
}

const MIN_RADIUS = 118;
const MIN_TILE = 78;
const MAX_TILE = 104;
const TILE_GAP = 10;

function layoutFor(count: number) {
    const tile = count <= 6 ? MAX_TILE : Math.max(MIN_TILE, MAX_TILE - (count - 6) * 5);
    const needed = ((tile + TILE_GAP) * count) / (2 * Math.PI);
    return { tile, radius: Math.max(MIN_RADIUS, Math.ceil(needed)) };
}

export function RadialWheel({ isOpen, pages, onSelect, onClose }: RadialWheelProps) {
    const { t } = useLanguage();
    const [pageIndex, setPageIndex] = useState(0);
    const [hovered, setHovered] = useState<string | null>(null);
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play("modal-open");
            setPageIndex(0);
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    const page = pages[Math.min(pageIndex, pages.length - 1)];
    const { tile, radius } = layoutFor(page ? page.items.length : 1);

    useEffect(() => {
        if (!isOpen || !page) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.code === "Tab") {
                e.preventDefault();
                setPageIndex((prev) => (prev + 1) % pages.length);
                return;
            }

            const index = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"].indexOf(e.code);
            if (index !== -1 && index < page.items.length) {
                e.preventDefault();
                const item = page.items[index];
                if (!item.locked) onSelect(page.id, item.id);
            }
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            setPageIndex((prev) => (prev + (e.deltaY > 0 ? 1 : pages.length - 1)) % pages.length);
        };

        window.addEventListener("keydown", onKey);
        window.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("wheel", onWheel);
        };
    }, [isOpen, page, pages.length, onSelect]);

    if (!isOpen || !page) return null;

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto font-oxanium bg-[rgba(6,8,12,0.55)] backdrop-blur-[2px]"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="relative" style={{ width: radius * 2 + tile + 24, height: radius * 2 + tile + 24 }}>
                <div className="absolute inset-0 rounded-full border border-white/10 bg-[rgba(13,17,23,0.55)]" />
                <div className="absolute inset-8 rounded-full border border-[#4FD1FF]/20" />

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div className="text-[#E5E7EB] text-sm font-black tracking-wider">{page.label.toUpperCase()}</div>
                    <div className="text-[#6B7280] text-[11px] mt-0.5">1–{page.items.length} or click</div>
                    {pages.length > 1 && (
                        <div className="flex items-center justify-center gap-1.5 mt-2">
                            {pages.map((p, i) => (
                                <button
                                    key={p.id}
                                    onClick={() => setPageIndex(i)}
                                    className="w-1.5 h-1.5 rounded-full border-0 p-0"
                                    style={{ background: i === pageIndex ? "#4FD1FF" : "rgba(255,255,255,0.25)" }}
                                />
                            ))}
                        </div>
                    )}
                    {pages.length > 1 && (
                        <div className="text-[#6B7280] text-[10px] mt-1.5">{t("g.wheel.switchHint")}</div>
                    )}
                </div>

                {page.items.map((item, index) => {
                    const angle = (index / page.items.length) * Math.PI * 2 - Math.PI / 2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const iconSize = Math.round(tile * 0.5);

                    return (
                        <div
                            key={item.id}
                            className="absolute left-1/2 top-1/2"
                            style={{
                                width: tile,
                                marginLeft: -tile / 2,
                                marginTop: -tile / 2,
                                transform: `translate(${x}px, ${y}px)`,
                                zIndex: hovered === item.id ? 10 : 1,
                            }}
                        >
                            <button
                                onClick={() => !item.locked && onSelect(page.id, item.id)}
                                onMouseEnter={() => setHovered(item.id)}
                                onMouseLeave={() => setHovered((current) => (current === item.id ? null : current))}
                                title={item.locked ? item.lockReason ?? t("g.wheel.locked") : item.hint ?? item.label}
                                className={`w-full flex flex-col items-center gap-0.5 py-1.5 rounded-2xl border transition-transform transition-colors duration-150 bg-[rgba(13,17,23,0.94)] ${item.locked
                                    ? "border-white/5 opacity-40 cursor-not-allowed"
                                    : "border-white/10 hover:border-[#4FD1FF] hover:scale-110"
                                    }`}
                            >
                                <span
                                    className="rounded-full flex items-center justify-center leading-none select-none"
                                    style={{
                                        width: iconSize,
                                        height: iconSize,
                                        fontSize: Math.round(iconSize * 0.6),
                                        background: `${item.accent}22`,
                                        boxShadow: `0 0 18px ${item.accent}33`,
                                    }}
                                >
                                    {item.emoji}
                                </span>
                                <span
                                    className="text-[#E5E7EB] font-bold leading-tight text-center px-1 truncate w-full"
                                    style={{ fontSize: tile >= 96 ? 11 : 10 }}
                                >
                                    {item.label}
                                </span>
                                <span className="text-[#6B7280] text-[9px] leading-none">{index + 1}</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
