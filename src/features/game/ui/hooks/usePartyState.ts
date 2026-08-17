// src/features/game/ui/hooks/usePartyState.ts
import { useCallback, useState } from "react";
import type { PartyInviteData, PartyStateData, PartyVitalsData } from "../../network/NetworkManager";

const EMPTY_PARTY: PartyStateData = { partyId: null, leaderId: null, members: [] };

export function usePartyState() {
  const [party, setParty] = useState<PartyStateData>(EMPTY_PARTY);
  const [invite, setInvite] = useState<PartyInviteData | null>(null);

  const handlePartyState = useCallback((state: PartyStateData) => {
    setParty(state);
  }, []);

  const handlePartyVitals = useCallback((members: PartyVitalsData[]) => {
    setParty((prev) => {
      if (!prev.partyId) return prev;

      const byId = new Map(members.map((entry) => [entry.id, entry]));
      let changed = false;

      const next = prev.members.map((member) => {
        const vitals = byId.get(member.id);
        if (!vitals) return member;
        if (
          vitals.health === member.health &&
          vitals.maxHealth === member.maxHealth &&
          vitals.alive === member.alive &&
          vitals.locationId === member.locationId
        ) {
          return member;
        }

        changed = true;
        return { ...member, ...vitals };
      });

      return changed ? { ...prev, members: next } : prev;
    });
  }, []);

  const handlePartyInvite = useCallback((data: PartyInviteData) => {
    setInvite(data);
  }, []);

  const handleInviteExpired = useCallback((fromId: string) => {
    setInvite((prev) => (prev && prev.fromId === fromId ? null : prev));
  }, []);

  const dismissInvite = useCallback(() => {
    setInvite(null);
  }, []);

  return {
    party,
    partyInvite: invite,
    handlePartyState,
    handlePartyVitals,
    handlePartyInvite,
    handleInviteExpired,
    dismissInvite,
  };
}
