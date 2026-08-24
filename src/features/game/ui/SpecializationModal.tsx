// src/features/game/ui/SpecializationModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, Sparkles } from "lucide-react";
import { BranchId, BRANCHES } from "../data/progression";
import { SKILL_NODES, columnsForBranch } from "../data/skills";
import { WindowFrame } from "./shell/WindowFrame";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface SpecializationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (branch: BranchId) => void;
}

function firstSkills(branch: BranchId): string[] {
    const columns = columnsForBranch(branch).filter((c) => c.branch === branch);
    return columns
        .map((column) => SKILL_NODES.find((node) => node.column === column.id && node.requires.columnPoints === 0))
        .filter((node): node is NonNullable<typeof node> => !!node)
        .map((node) => node.name);
}

export function SpecializationModal({ isOpen, onClose, onSelect }: SpecializationModalProps) {
    const { t } = useLanguage();
    const [pending, setPending] = useState<BranchId | null>(null);
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) setPending(null);
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.spec.choose")}
            icon={<Sparkles className="w-5 h-5" />}
            size="lg"
            footer={
                <button
                    onClick={() => pending && onSelect(pending)}
                    disabled={!pending}
                    className="w-full min-h-[var(--tap-target)] bg-gradient-to-r from-[#4FD1FF] to-[#3BA9E8] text-[rgba(12,12,14,0.9)] font-bold px-6 py-3 rounded-[8px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {pending ? t("g.spec.become", { name: t(BRANCHES.find((b) => b.id === pending)?.name ?? "") }) : t("g.spec.pick")}
                </button>
            }
        >
            <p className="text-[#8B8F98] text-xs mb-4">{t("g.spec.intro")}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {BRANCHES.map((branch) => {
                    const selected = pending === branch.id;
                    const skills = firstSkills(branch.id);

                    return (
                        <button
                            key={branch.id}
                            onClick={() => setPending(branch.id)}
                            className="text-left rounded-[12px] border-2 p-4 sm:p-5 transition-all"
                            style={{
                                borderColor: selected ? branch.accent : "rgba(255,255,255,0.08)",
                                background: selected ? `${branch.accent}14` : "rgba(0,0,0,0.25)",
                                boxShadow: selected ? `0 0 24px ${branch.accent}22` : "none",
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                {branch.weapon === "rifle" ? (
                                    <Crosshair className="w-5 h-5" style={{ color: branch.accent }} />
                                ) : (
                                    <Sparkles className="w-5 h-5" style={{ color: branch.accent }} />
                                )}
                                <span className="text-lg font-black" style={{ color: branch.accent }}>
                                    {t(branch.name)}
                                </span>
                            </div>

                            <p className="text-[#8B8F98] text-xs mb-4">{t(branch.tagline)}</p>

                            <div className="text-[10px] font-bold tracking-wider text-[#6B7280] mb-1.5">
                                {t("g.spec.startsWith")}
                            </div>
                            <div className="text-[#E5E7EB] text-xs mb-3">
                                {branch.weapon === "rifle" ? "Standard Rifle" : "Wooden Branch staff"}
                            </div>

                            <div className="text-[10px] font-bold tracking-wider text-[#6B7280] mb-1.5">
                                {t("g.spec.firstSkills")}
                            </div>
                            <ul className="space-y-0.5">
                                {skills.map((name) => (
                                    <li key={name} className="text-[#E5E7EB] text-xs">
                                        · {t(name)}
                                    </li>
                                ))}
                            </ul>
                        </button>
                    );
                })}
            </div>
        </WindowFrame>
    );
}
