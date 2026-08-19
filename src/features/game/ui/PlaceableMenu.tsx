// src/features/game/ui/PlaceableMenu.tsx
"use client";

import { PLACEABLE_ITEMS } from "../data/placeableItems";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface PlaceableMenuProps {
    isOpen: boolean;
    onClose: () => void;
    placeables: Record<string, number>;
    onSelect: (itemId: string) => void;
    isInOwnFactionRoom: boolean;
}

export function PlaceableMenu({ isOpen, onClose, placeables, onSelect, isInOwnFactionRoom }: PlaceableMenuProps) {
    const { t } = useLanguage();
    if (!isOpen) return null;

    const available = isInOwnFactionRoom
        ? []
        : PLACEABLE_ITEMS.filter((item) => {
            if (item.placeable === false) return false;
            if (item.price === 0) return true;
            return (placeables[item.id] || 0) > 0;
        });

    return (
        <div
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xs bg-[rgba(12,14,16,0.95)] border-2 border-[#4FD1FF]/40 rounded-[16px] p-4 shadow-[0_0_35px_rgba(79,209,255,0.15)]"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-[#E5E7EB] text-sm font-black mb-3 tracking-wide">{t("g.place.title")}</h3>
                {available.length === 0 ? (
                    <p className="text-[#6B7280] text-xs text-center py-4">
                        {isInOwnFactionRoom
                            ? t("g.place.useConsole")
                            : t("g.place.empty")}
                    </p>
                ) : (
                    <div className="space-y-1.5">
                        {available.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onSelect(item.id);
                                    onClose();
                                }}
                                className="w-full flex items-center gap-3 bg-black/40 border border-zinc-700 hover:border-[#4FD1FF] rounded-lg px-3 py-2.5 transition-colors text-left"
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className="flex-1 text-[#E5E7EB] text-sm font-bold">{t(item.name)}</span>
                                <span className="text-[#8B8F98] text-xs">
                                    {item.price === 0 ? t("g.place.free") : `x${placeables[item.id] || 0}`}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
