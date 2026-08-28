// src/features/game/core/FactionWarState.ts
import { FactionWarSummary } from "../network/NetworkManager";
import { Hostility, OtherPlayer } from "../entities/OtherPlayer";

export class FactionWarState {
    private wars: FactionWarSummary[] = [];
    private factionIdsByPlayer = new Map<string, string[]>();
    private myFactionIds: string[] = [];
    private sidesByPlayer = new Map<string, Map<string, string | null>>();
    private mySides = new Map<string, string | null>();
    private hearts = new Map<string, { hp: number; maxHp: number }>();

    public setWars(wars: FactionWarSummary[]) {
        this.wars = wars;

        for (const war of wars) {
            this.hearts.set(war.declarerFactionId, { hp: war.declarerHeartHp, maxHp: war.heartMaxHp });
            this.hearts.set(war.defenderFactionId, { hp: war.defenderHeartHp, maxHp: war.heartMaxHp });
        }

        const alive = new Set(wars.flatMap((war) => [war.declarerFactionId, war.defenderFactionId]));
        for (const factionId of Array.from(this.hearts.keys())) {
            if (!alive.has(factionId)) this.hearts.delete(factionId);
        }
    }

    public allWars(): FactionWarSummary[] {
        return this.wars;
    }

    public setMyFactionIds(ids: Iterable<string>) {
        this.myFactionIds = Array.from(ids);
    }

    public setPlayerFactions(netId: string, factionIds: string[]) {
        this.factionIdsByPlayer.set(netId, factionIds);
    }

    public forgetPlayer(netId: string) {
        this.factionIdsByPlayer.delete(netId);
        this.sidesByPlayer.delete(netId);
    }

    public setPlayerSide(netId: string, warId: string, sideFactionId: string | null) {
        const byWar = this.sidesByPlayer.get(netId) ?? new Map<string, string | null>();
        byWar.set(warId, sideFactionId);
        this.sidesByPlayer.set(netId, byWar);
    }

    public setMySide(warId: string, sideFactionId: string | null) {
        this.mySides.set(warId, sideFactionId);
    }

    public mySideIn(warId: string): string | null | undefined {
        return this.mySides.get(warId);
    }

    private sideOf(war: FactionWarSummary, factionIds: string[], stored: Map<string, string | null> | undefined): string | null {
        const torn: string[] = [];
        if (factionIds.includes(war.declarerFactionId)) torn.push(war.declarerFactionId);
        if (factionIds.includes(war.defenderFactionId)) torn.push(war.defenderFactionId);

        if (torn.length === 0) return null;
        if (torn.length === 1) return torn[0];

        const chosen = stored?.get(war.id);
        return chosen === undefined ? null : chosen;
    }

    public setHeart(factionId: string, hp: number, maxHp: number) {
        this.hearts.set(factionId, { hp, maxHp });
    }

    public heartOf(factionId: string): { hp: number; maxHp: number } | null {
        return this.hearts.get(factionId) ?? null;
    }

    public warFor(factionId: string): FactionWarSummary | null {
        return this.wars.find(
            (war) => war.declarerFactionId === factionId || war.defenderFactionId === factionId
        ) ?? null;
    }

    public myWar(): FactionWarSummary | null {
        for (const factionId of this.myFactionIds) {
            const war = this.warFor(factionId);
            if (war) return war;
        }
        return null;
    }

    public atWar(): boolean {
        return this.myWar() !== null;
    }

    private hostileFactions(): Set<string> {
        const hostile = new Set<string>();

        for (const war of this.wars) {
            const mineIsDeclarer = this.myFactionIds.includes(war.declarerFactionId);
            const mineIsDefender = this.myFactionIds.includes(war.defenderFactionId);

            if (mineIsDeclarer && !mineIsDefender) hostile.add(war.defenderFactionId);
            if (mineIsDefender && !mineIsDeclarer) hostile.add(war.declarerFactionId);
        }

        return hostile;
    }

    public hostilityOf(netId: string): Hostility {
        const theirs = this.factionIdsByPlayer.get(netId);
        if (!theirs || theirs.length === 0) return "none";

        const theirSides = this.sidesByPlayer.get(netId);

        for (const war of this.wars) {
            const mine = this.sideOf(war, this.myFactionIds, this.mySides);
            if (!mine) continue;

            const theirSide = this.sideOf(war, theirs, theirSides);
            if (theirSide === mine) continue;

            const touchesWar = theirs.includes(war.declarerFactionId) || theirs.includes(war.defenderFactionId);
            if (!touchesWar) continue;

            return theirSide === null ? "neutral" : "enemy";
        }

        return "none";
    }

    public refresh(otherPlayers: Map<string, OtherPlayer>) {
        for (const [netId, player] of otherPlayers) {
            player.setHostility(this.hostilityOf(netId));
        }
    }
}
