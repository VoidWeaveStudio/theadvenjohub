// src/features/game/ui/AlaricPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { FactionSummary } from "../network/NetworkManager";
import { FactionCreateForm } from "./FactionCreateForm";
import { useLanguage } from "@/core/i18n/LanguageContext";

type Stage = "already-founder" | "intro" | "responsibility" | "create" | "success";

interface AlaricPanelProps {
    isOpen: boolean;
    onClose: () => void;
    myFactions: FactionSummary[];
    skipIntro: boolean;
    gameSlug: string;
    onCreated: () => void;
}

export function AlaricPanel({ isOpen, onClose, myFactions, skipIntro, gameSlug, onCreated }: AlaricPanelProps) {
    const { t } = useLanguage();
    const [stage, setStage] = useState<Stage>("intro");
    const [createdFactionName, setCreatedFactionName] = useState<string | null>(null);

    const wasOpenRef = useRef(false);

    const existingFounded = myFactions.find((f) => f.role === "founder") ?? null;

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setCreatedFactionName(null);
            return;
        }
        if (existingFounded) {
            setStage("already-founder");
        } else if (skipIntro) {
            setStage("create");
        } else {
            setStage("intro");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-2 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-md bg-[rgba(18,10,24,0.95)] border-2 border-[#a855f7]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(168,85,247,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Flag className="w-5 h-5 text-[#a855f7]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.npc.alaric")}</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                {stage === "already-founder" && (
                    <div className="space-y-5">
                        <p className="text-[#8B8F98] text-sm">
                            {t("g.alaric.alreadyLead").split("{name}")[0]}
                            <span className="text-[#E5E7EB] font-bold">{existingFounded?.name}</span>
                            {t("g.alaric.alreadyLead").split("{name}")[1]}
                        </p>
                        <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm w-full">
                            {t("g.alaric.understood")}
                        </button>
                    </div>
                )}

                {stage === "intro" && (
                    <div className="space-y-5">
                        <p className="text-[#6B7280] text-sm">{t("g.alaric.thatLook")}</p>
                        <p className="text-[#E5E7EB] text-base font-bold">{t("g.alaric.wantToFound")}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setStage("responsibility")} className="btn-primary px-4 py-2 text-sm flex-1">
                                {t("g.alaric.yes")}
                            </button>
                            <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm flex-1">
                                {t("g.alaric.no")}
                            </button>
                        </div>
                    </div>
                )}

                {stage === "responsibility" && (
                    <div className="space-y-5">
                        <p className="text-[#8B8F98] text-sm">
                            {t("g.alaric.responsibility")}
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setStage("create")} className="btn-primary px-4 py-2 text-sm flex-1">
                                {t("g.alaric.iUnderstand")}
                            </button>
                            <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm flex-1">
                                {t("g.alaric.notNow")}
                            </button>
                        </div>
                    </div>
                )}

                {stage === "create" && (
                    <div className="space-y-3">
                        <FactionCreateForm
                            gameSlug={gameSlug}
                            onCreated={(name) => {
                                setCreatedFactionName(name);
                                onCreated();
                                setStage("success");
                            }}
                        />

                        <div className="mt-2 pt-3 border-t border-[rgba(255,255,255,0.08)] flex gap-2">
                            <span className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold bg-[#a855f7]/15 text-[#a855f7]">
                                <Flag className="w-3.5 h-3.5" />
                                {t("g.alaric.createFaction")}
                            </span>
                        </div>
                    </div>
                )}

                {stage === "success" && (
                    <div className="space-y-5">
                        <p className="text-[#8B8F98] text-sm">
                            {t("g.alaric.created").split("{name}")[0]}
                            <span className="text-[#E5E7EB] font-bold">{createdFactionName}</span>
                            {t("g.alaric.created").split("{name}")[1]}
                        </p>
                        <button onClick={onClose} className="btn-primary px-4 py-2 text-sm w-full">
                            {t("g.alaric.close")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
