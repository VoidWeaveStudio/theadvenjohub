//src\features\game\ui\Crosshair.tsx
"use client";

interface CrosshairProps {
    visible: boolean;
}

export function Crosshair({ visible }: CrosshairProps) {
    if (!visible) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-8 h-8">
                <div className="absolute top-1/2 left-0 w-2 h-0.5 bg-white/80 -translate-y-1/2" />
                <div className="absolute top-1/2 right-0 w-2 h-0.5 bg-white/80 -translate-y-1/2" />
                <div className="absolute left-1/2 top-0 h-2 w-0.5 bg-white/80 -translate-x-1/2" />
                <div className="absolute left-1/2 bottom-0 h-2 w-0.5 bg-white/80 -translate-x-1/2" />
                <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
            </div>
        </div>
    );
}