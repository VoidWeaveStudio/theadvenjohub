// src/features/game/ui/shell/SubTabs.tsx
"use client";

function activeClass(isActive: boolean): string {
    return isActive
        ? "text-[#0A0E14] bg-[#4FD1FF]"
        : "text-[#8B8F98] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.09)] hover:text-[#E5E7EB]";
}

export function SubTabs({
    tabs,
    active,
    onChange,
}: {
    tabs: { id: string; label: string; badge?: number }[];
    active: string;
    onChange: (id: string) => void;
}) {
    return (
        <div className="flex gap-1.5 mb-4">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-colors ${activeClass(active === tab.id)}`}
                >
                    {tab.label}
                    {!!tab.badge && (
                        <span className={`px-1.5 rounded-full text-[10px] ${active === tab.id ? "bg-[#0A0E14] text-[#4FD1FF]" : "bg-[#4FD1FF] text-[#0A0E14]"}`}>
                            {tab.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
