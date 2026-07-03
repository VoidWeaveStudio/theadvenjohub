//src\features\game\ui\OnlineCounter.tsx
"use client";

interface OnlineCounterProps {
    count: number;
    maxCount?: number;
}

export function OnlineCounter({ count, maxCount = 100 }: OnlineCounterProps) {
    const percentage = (count / maxCount) * 100;

    return (
        <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-white/10 flex items-center gap-3">
            <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="text-white font-bold text-lg">{count}</span>
                <span className="text-zinc-400 text-sm">/ {maxCount}</span>
            </div>

            <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-300 ${percentage > 80 ? "bg-red-500" : percentage > 50 ? "bg-yellow-500" : "bg-green-500"
                        }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}