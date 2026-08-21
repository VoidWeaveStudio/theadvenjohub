// src/features/game/ui/CrateOpening.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
    COMPANIONS,
    COMPANIONS_BY_ID,
    RARITY_META,
    TOTAL_DROP_WEIGHT,
    type CompanionId,
} from "../data/companions";
import { CrateOpenedData } from "../network/NetworkManager";
import { SoundManager } from "../core/SoundManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

const TILE_WIDTH = 108;
const TILE_GAP = 8;
const STEP = TILE_WIDTH + TILE_GAP;
const REEL_LENGTH = 56;
const WIN_INDEX = 48;
const SPIN_MS = 5400;

interface CrateOpeningProps {
    isOpen: boolean;
    result: CrateOpenedData | null;
    cratesLeft: number;
    onOpenAnother: () => void;
    onClose: () => void;
}

function weightedPick(): CompanionId {
    let ticket = Math.random() * TOTAL_DROP_WEIGHT;
    for (const entry of COMPANIONS) {
        ticket -= entry.dropWeight;
        if (ticket < 0) return entry.id;
    }
    return COMPANIONS[0].id;
}

function buildReel(winner: CompanionId): CompanionId[] {
    const reel: CompanionId[] = [];
    for (let i = 0; i < REEL_LENGTH; i++) {
        reel.push(i === WIN_INDEX ? winner : weightedPick());
    }
    return reel;
}

export function CrateOpening({ isOpen, result, cratesLeft, onOpenAnother, onClose }: CrateOpeningProps) {
    const { t } = useLanguage();
    const [phase, setPhase] = useState<"waiting" | "spinning" | "revealed">("waiting");
    const [offset, setOffset] = useState(0);
    const [reel, setReel] = useState<CompanionId[]>([]);
    const settleRef = useRef<number | null>(null);
    const spunForRef = useRef<CrateOpenedData | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setPhase("waiting");
            setOffset(0);
            setReel([]);
            spunForRef.current = null;
            if (settleRef.current) window.clearTimeout(settleRef.current);
            settleRef.current = null;
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || result) return;
        setPhase("waiting");
        setOffset(0);
        setReel([]);
        spunForRef.current = null;
    }, [isOpen, result]);

    useEffect(() => {
        if (!isOpen || !result || spunForRef.current === result) return;

        spunForRef.current = result;
        setReel(buildReel(result.itemId));
        setOffset(0);
        setPhase("spinning");

        const jitter = (Math.random() - 0.5) * (TILE_WIDTH - 34);
        const target = -(WIN_INDEX * STEP + jitter);

        const frame = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => setOffset(target));
        });

        settleRef.current = window.setTimeout(() => {
            setPhase("revealed");
            SoundManager.getInstance().play("loot-pickup");
        }, SPIN_MS + 120);

        return () => {
            window.cancelAnimationFrame(frame);
            if (settleRef.current) window.clearTimeout(settleRef.current);
        };
    }, [isOpen, result]);

    const won = useMemo(
        () => (result ? COMPANIONS_BY_ID.get(result.itemId) ?? null : null),
        [result]
    );

    if (!isOpen) return null;

    const wonRarity = won ? RARITY_META[won.rarity] : null;

    return (
        <div className="pointer-events-auto absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 font-oxanium">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[rgba(13,17,23,0.98)] shadow-[0_12px_48px_rgba(0,0,0,0.65)]">
                <div className="flex items-center gap-2.5 px-6 py-4">
                    <Sparkles className="h-4 w-4 text-[#FFD166]" />
                    <h2 className="text-base font-black tracking-wide text-[#E5E7EB]">{t("g.crate.openingTitle")}</h2>
                </div>

                {phase !== "revealed" && (
                    <div className="relative mx-4 mb-4 h-[132px] overflow-hidden rounded-xl border border-white/10 bg-[rgba(0,0,0,0.35)]">
                        <div className="absolute inset-y-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-[#FFD166] shadow-[0_0_12px_rgba(255,209,102,0.9)]" />
                        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[rgba(13,17,23,0.98)] to-transparent" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[rgba(13,17,23,0.98)] to-transparent" />

                        {reel.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">
                                {t("g.crate.rolling")}
                            </div>
                        ) : (
                            <div
                                className="absolute top-1/2 left-1/2 flex -translate-y-1/2"
                                style={{
                                    gap: `${TILE_GAP}px`,
                                    marginLeft: `-${TILE_WIDTH / 2}px`,
                                    transform: `translateX(${offset}px)`,
                                    transition: phase === "spinning" ? `transform ${SPIN_MS}ms cubic-bezier(0.08,0.72,0.12,1)` : "none",
                                }}
                            >
                                {reel.map((id, index) => {
                                    const entry = COMPANIONS_BY_ID.get(id)!;
                                    const rarity = RARITY_META[entry.rarity];
                                    return (
                                        <div
                                            key={`${id}-${index}`}
                                            className="flex flex-col items-center justify-center gap-1 rounded-lg border"
                                            style={{
                                                width: `${TILE_WIDTH}px`,
                                                height: "104px",
                                                borderColor: `${rarity.color}66`,
                                                background: `linear-gradient(180deg, ${rarity.glow} -70%, rgba(255,255,255,0.04) 60%)`,
                                            }}
                                        >
                                            <span className="text-3xl">{entry.icon}</span>
                                            <span
                                                className="text-[9px] font-black uppercase tracking-widest"
                                                style={{ color: rarity.color }}
                                            >
                                                {t(rarity.labelKey)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {phase === "revealed" && won && wonRarity && (
                    <div className="px-6 pb-2">
                        <div
                            className="flex flex-col items-center gap-2 rounded-xl border px-6 py-7"
                            style={{
                                borderColor: `${wonRarity.color}88`,
                                background: `radial-gradient(circle at 50% 0%, ${wonRarity.glow} -20%, rgba(255,255,255,0.03) 65%)`,
                                boxShadow: `0 0 34px ${wonRarity.glow}`,
                            }}
                        >
                            <span className="text-6xl drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)]">{won.icon}</span>
                            <span
                                className="text-[11px] font-black uppercase tracking-[0.25em]"
                                style={{ color: wonRarity.color }}
                            >
                                {t(wonRarity.labelKey)}
                            </span>
                            <span className="text-xl font-black text-[#E5E7EB]">{t(won.nameKey)}</span>
                            <span className="text-center text-xs text-[#8B8F98]">{t(won.descriptionKey)}</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 px-6 py-4">
                    <span className="text-xs text-[#6B7280]">
                        {t("g.crate.cratesLeft", { count: cratesLeft })}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={onOpenAnother}
                            disabled={phase !== "revealed" || cratesLeft <= 0}
                            className="btn-secondary px-4 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {t("g.crate.openAnother")}
                        </button>
                        <button
                            onClick={onClose}
                            disabled={phase === "spinning"}
                            className="btn-primary px-4 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {t("g.crate.done")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
