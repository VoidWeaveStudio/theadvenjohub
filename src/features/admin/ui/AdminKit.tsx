// src/features/admin/ui/AdminKit.tsx
"use client";

import { ReactNode } from "react";
import { Search } from "lucide-react";

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "violet";

export function Panel({ title, actions, children, flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
    return (
        <section className="a-panel">
            {(title || actions) && (
                <header className="a-panel-head">
                    {title && <span className="a-panel-title">{title}</span>}
                    {actions && <div className="a-row a-spacer">{actions}</div>}
                </header>
            )}
            <div className={flush ? "a-panel-body a-panel-body-flush" : "a-panel-body"}>{children}</div>
        </section>
    );
}

export function Stat({ label, value, hint, tone = "neutral", icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode }) {
    return (
        <div className="a-stat" data-tone={tone}>
            <div className="a-stat-label">
                {icon}
                {label}
            </div>
            <div className="a-stat-value">{value}</div>
            {hint && <div className="a-stat-hint">{hint}</div>}
        </div>
    );
}

export function Tile({ label, value }: { label: ReactNode; value: ReactNode }) {
    return (
        <div className="a-tile">
            <div className="a-tile-label">{label}</div>
            <div className="a-tile-value">{value}</div>
        </div>
    );
}

export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
    return (
        <span className="a-badge" data-tone={tone}>
            {dot && <span className="a-dot" />}
            {children}
        </span>
    );
}

export function Alert({ tone = "bad", children }: { tone?: Tone; children: ReactNode }) {
    if (!children) return null;
    return (
        <div className="a-alert" data-tone={tone}>
            {children}
        </div>
    );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (next: string) => void; placeholder: string }) {
    return (
        <label className="a-search">
            <Search />
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        </label>
    );
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string; count?: number }[]; onChange: (next: T) => void }) {
    return (
        <div className="a-chips">
            {options.map((option) => (
                <button key={option.id} type="button" className="a-chip" data-active={value === option.id} onClick={() => onChange(option.id)}>
                    {option.label}
                    {typeof option.count === "number" ? ` · ${option.count}` : ""}
                </button>
            ))}
        </div>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="a-empty">{children}</div>;
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div>
            <span className="a-label">{label}</span>
            {children}
        </div>
    );
}

export function Modal({ onClose, size, children }: { onClose: () => void; size?: "sm"; children: ReactNode }) {
    return (
        <div className="a-modal" onClick={onClose}>
            <div className="a-modal-card" data-size={size} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}

export function truncateWallet(wallet: string | null | undefined): string {
    if (!wallet) return "—";
    if (wallet.length <= 12) return wallet;
    return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

export function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
}

export function formatRelative(iso: string | null | undefined): string {
    if (!iso) return "never";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "never";
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return date.toLocaleDateString();
}

export function formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "0";
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) return "0";
    return parsed.toLocaleString("en-US");
}

export function formatUsd(cents: number | null | undefined): string {
    const value = (Number(cents) || 0) / 100;
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPlaytime(seconds: number | null | undefined): string {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
