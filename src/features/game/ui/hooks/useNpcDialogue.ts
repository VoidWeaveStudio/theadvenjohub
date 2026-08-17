// src/features/game/ui/hooks/useNpcDialogue.ts
import { useCallback, useRef, useState } from "react";
import { NPC_DIALOGUES_BY_ID, NpcDialogue, NpcId } from "../../data/npcDialogues";

export function useNpcDialogue(onMet: (npcId: NpcId) => void) {
    const [dialogue, setDialogue] = useState<NpcDialogue | null>(null);
    const activeRef = useRef<NpcDialogue | null>(null);
    const metRef = useRef<Set<string>>(new Set());
    const pendingRef = useRef<(() => void) | null>(null);

    const handleMetNpcs = useCallback((metNpcs: string[]) => {
        for (const npcId of metNpcs) metRef.current.add(npcId);
    }, []);

    const greet = useCallback((npcId: NpcId, openPanel: () => void) => {
        const definition = NPC_DIALOGUES_BY_ID.get(npcId);

        if (!definition || metRef.current.has(npcId)) {
            openPanel();
            return;
        }

        pendingRef.current = openPanel;
        activeRef.current = definition;
        setDialogue(definition);
        document.exitPointerLock();
    }, []);

    const finish = useCallback(() => {
        const current = activeRef.current;

        if (current && !metRef.current.has(current.id)) {
            metRef.current.add(current.id);
            onMet(current.id);
        }

        activeRef.current = null;
        setDialogue(null);

        const pending = pendingRef.current;
        pendingRef.current = null;
        pending?.();
    }, [onMet]);

    return { dialogue, greet, finish, handleMetNpcs };
}
