// src/features/game/ui/SkillTreeWindow.tsx
"use client";

import { Zap } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { SkillTreePanel } from "./SkillTreePanel";
import { ProgressionStateData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface SkillTreeWindowProps {
    isOpen: boolean;
    onClose: () => void;
    progression: ProgressionStateData | null;
    onLearn: (nodeId: string) => void;
    onBind: (slot: string, abilityId: string | null) => void;
    onOpenSpecialization: () => void;
}

export function SkillTreeWindow({ isOpen, onClose, progression, onLearn, onBind, onOpenSpecialization }: SkillTreeWindowProps) {
    const { t } = useLanguage();

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.skill.title")}
            size="xl"
            icon={<Zap className="w-7 h-7" />}
        >
            <SkillTreePanel
                active={isOpen}
                progression={progression}
                onLearn={onLearn}
                onBind={onBind}
                onOpenSpecialization={onOpenSpecialization}
            />
        </WindowFrame>
    );
}
