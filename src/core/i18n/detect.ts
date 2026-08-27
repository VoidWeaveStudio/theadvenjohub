// src/core/i18n/detect.ts
import { LANGUAGES, type Language } from "./types";

const SUPPORTED = new Set<string>(LANGUAGES);


export function normaliseTag(tag: string): Language | null {
    const lower = tag.trim().toLowerCase();
    if (!lower) return null;
    if (lower.startsWith("fil") || lower.startsWith("tl")) return "fil";
    if (lower.startsWith("zh")) return /hant|-tw|-hk|-mo/.test(lower) ? "zh-tw" : "zh";
    if (lower.startsWith("in")) return "id";

    const base = lower.split("-")[0];
    return SUPPORTED.has(base) ? (base as Language) : null;
}

export function languageFromCookieHeader(cookieHeader: string | null | undefined): Language | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)language=([^;]+)/);
    if (!match) return null;
    const stored = decodeURIComponent(match[1]);
    return SUPPORTED.has(stored) ? (stored as Language) : null;
}

export function languageFromAcceptHeader(acceptLanguage: string | null | undefined): Language | null {
    if (!acceptLanguage) return null;

    const ranked = acceptLanguage
        .split(",")
        .map((part) => {
            const [tag, ...params] = part.split(";");
            const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
            return { tag: tag.trim(), q: q ? Number.parseFloat(q.slice(2)) || 0 : 1 };
        })
        .filter((entry) => entry.tag && entry.tag !== "*")
        .sort((a, b) => b.q - a.q);

    for (const entry of ranked) {
        const resolved = normaliseTag(entry.tag);
        if (resolved) return resolved;
    }
    return null;
}


export function resolveLanguage(sources: {
    override?: string | null;
    cookie?: string | null;
    acceptLanguage?: string | null;
}): Language {
    if (sources.override) {
        const resolved = normaliseTag(sources.override);
        if (resolved) return resolved;
    }
    return languageFromCookieHeader(sources.cookie) ?? languageFromAcceptHeader(sources.acceptLanguage) ?? "en";
}
