// src/features/game/ui/hooks/useNpcDialogue.ts
import { useCallback, useRef, useState } from "react";
import { NPC_DIALOGUES_BY_ID, NpcDialogue, NpcId } from "../../data/npcDialogues";

const STORAGE_KEY = "tanjo:met-npcs";

function loadMet(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
}

function saveMet(met: Set<string>) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(met)));
    } catch {
        return;
    }
}

export function useNpcDialogue() {
    const [dialogue, setDialogue] = useState<NpcDialogue | null>(null);
    const metRef = useRef<Set<string> | null>(null);
    const pendingRef = useRef<(() => void) | null>(null);

    const met = () => {
        if (!metRef.current) metRef.current = loadMet();
        return metRef.current;
    };

    const greet = useCallback((npcId: NpcId, openPanel: () => void) => {
        const definition = NPC_DIALOGUES_BY_ID.get(npcId);

        if (!definition || met().has(npcId)) {
            openPanel();
            return;
        }

        pendingRef.current = openPanel;
        setDialogue(definition);
        document.exitPointerLock();
    }, []);

    const finish = useCallback(() => {
        setDialogue((current) => {
            if (current) {
                const known = met();
                known.add(current.id);
                saveMet(known);
            }
            return null;
        });

        const pending = pendingRef.current;
        pendingRef.current = null;
        pending?.();
    }, []);

    return { dialogue, greet, finish };
}
