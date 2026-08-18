// src/features/game/ui/ScopeOverlay.tsx
"use client";

interface ScopeOverlayProps {
    active: boolean;
    zoomStep: number;
}

export function ScopeOverlay({ active, zoomStep }: ScopeOverlayProps) {
    if (!active) return null;

    return (
        <div className="absolute inset-0 pointer-events-none select-none z-40">
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 27vh, rgba(0,0,0,0.94) 27.6vh, #000 40vh)",
                }}
            />

            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="50" y1="0" x2="50" y2="42" stroke="rgba(10,10,10,0.9)" strokeWidth="0.18" />
                <line x1="50" y1="58" x2="50" y2="100" stroke="rgba(10,10,10,0.9)" strokeWidth="0.18" />
                <line x1="0" y1="50" x2="42" y2="50" stroke="rgba(10,10,10,0.9)" strokeWidth="0.18" />
                <line x1="58" y1="50" x2="100" y2="50" stroke="rgba(10,10,10,0.9)" strokeWidth="0.18" />
            </svg>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative" style={{ width: "54vh", height: "54vh" }}>
                    <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-[rgba(10,10,10,0.85)]" />
                    <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-[rgba(10,10,10,0.85)]" />

                    {[-3, -2, -1, 1, 2, 3].map((tick) => (
                        <div
                            key={`v${tick}`}
                            className="absolute left-1/2 h-px bg-[rgba(10,10,10,0.7)]"
                            style={{
                                width: Math.abs(tick) === 3 ? "3.2vh" : "2vh",
                                top: `${50 + tick * 7}%`,
                                transform: "translateX(-50%)",
                            }}
                        />
                    ))}

                    <div className="absolute left-1/2 top-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(10,10,10,0.9)]" />

                    <div
                        className="absolute inset-0 rounded-full"
                        style={{ boxShadow: "inset 0 0 60px 18px rgba(0,0,0,0.55)" }}
                    />
                </div>
            </div>

            <div className="absolute bottom-[22vh] left-1/2 -translate-x-1/2 text-[#8B8F98] text-[11px] font-oxanium tracking-widest">
                {zoomStep === 2 ? "4×" : "2×"} · [RMB] cycle
            </div>
        </div>
    );
}
