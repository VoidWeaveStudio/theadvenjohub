// src/features/admin/lib/useAdminLabel.ts
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";

export function useAdminLabel(): (key: string) => string {
    const { t } = useLanguage();
    return (key: string) => (key.startsWith("g.") ? t(key) : key);
}
