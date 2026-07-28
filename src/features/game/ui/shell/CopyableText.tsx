// src/features/game/ui/shell/CopyableText.tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyableTextProps {
    value: string;
    display?: string;
    className?: string;
    iconClassName?: string;
}

export function CopyableText({ value, display, className = "", iconClassName = "w-3.5 h-3.5" }: CopyableTextProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title="Copy to clipboard"
            className={`inline-flex items-center gap-1.5 hover:text-[#4FD1FF] transition-colors ${className}`}
        >
            <span className="font-mono truncate">{display ?? value}</span>
            {copied ? (
                <Check className={`${iconClassName} text-[#4ADE80] flex-shrink-0`} />
            ) : (
                <Copy className={`${iconClassName} flex-shrink-0`} />
            )}
        </button>
    );
}
