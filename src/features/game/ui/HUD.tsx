// src/features/game/ui/HUD.tsx
import type { ReactNode } from "react";
import { HUDState } from "../core/Game";
import { Crosshair } from "./Crosshair";
import { OnlineCounter } from "./OnlineCounter";
import { Heart, Shield, Activity, Mic, ShieldCheck, Swords, Crown } from "lucide-react";
import { ShardSwitcher } from "./ShardSwitcher";
import { XpBar } from "./XpBar";
import type { ShardStateData, ProgressionStateData, PartyMemberData } from "../network/NetworkManager";
import type { XpPopup } from "./hooks/useProgressionState";
import { TOP_MENU_BAND_PX } from "./hudLayout";

interface HUDProps {
    state: HUDState;
    isPointerLocked: boolean;
    isHitMark?: boolean;
    isTalking?: boolean;
    spawnProtectionSeconds?: number;
    combatRemainingMs?: number;
    partyMembers?: PartyMemberData[];
    partyLeaderId?: string | null;
    localPlayerId?: string | null;
    shardState?: ShardStateData | null;
    onSwitchShard?: (instance: number) => void;
    progression?: ProgressionStateData | null;
    xpPopups?: XpPopup[];
    onOpenSkills?: () => void;
    rightRail?: ReactNode;
    topCenter?: ReactNode;
}

export function HUD({ state, isPointerLocked, isHitMark = false, isTalking = false, spawnProtectionSeconds = 0, combatRemainingMs = 0, partyMembers = [], partyLeaderId = null, localPlayerId = null, shardState = null, onSwitchShard, progression = null, xpPopups = [], onOpenSkills, rightRail, topCenter }: HUDProps) {
    const partyFrames = partyMembers.filter((member) => member.id !== localPlayerId);
    const healthPercentage = (state.health / state.maxHealth) * 100;

    return (
        <div className="absolute inset-0 pointer-events-none select-none font-oxanium">
            <div className="absolute top-6 left-6">
                <div className="flex items-end gap-3">
                    <div>
                        <div className="bg-[rgba(12,12,14,0.72)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-[10px] p-4 min-w-[220px]">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-[#FF5757] fill-[#FF5757]" />
                                    <span className="text-[#E5E7EB] text-xs font-bold tracking-wider">HEALTH</span>
                                </div>
                                <span className="text-[#E5E7EB] text-lg font-bold">{state.health}</span>
                            </div>
                            <div className="w-full h-2 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#FF5757] to-[#FF7B7B] transition-all duration-300 ease-out"
                                    style={{ width: `${healthPercentage}%` }}
                                />
                            </div>
                        </div>

                        <XpBar progression={progression} popups={xpPopups} onOpenSkills={onOpenSkills} />

                        {partyFrames.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                                {partyFrames.map((member) => {
                                    const memberHealth = member.maxHealth > 0
                                        ? Math.max(0, Math.min(100, (member.health / member.maxHealth) * 100))
                                        : 0;

                                    return (
                                        <div
                                            key={member.id}
                                            className="bg-[rgba(12,12,14,0.72)] backdrop-blur-md border border-[rgba(138,212,255,0.2)] rounded-[8px] px-3 py-1.5 min-w-[220px]"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {member.id === partyLeaderId && <Crown className="w-3 h-3 text-[#FFD166] shrink-0" />}
                                                <span className="text-[#C9CDD3] text-[11px] font-bold truncate">{member.nickname}</span>
                                                <span className={`text-[10px] ml-auto ${member.alive ? "text-[#6B7280]" : "text-red-400 font-bold"}`}>
                                                    {member.alive ? member.health : "DOWN"}
                                                </span>
                                            </div>
                                            <div className="mt-1 w-full h-1 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ease-out ${member.alive ? "bg-[#8AD4FF]" : "bg-zinc-700"}`}
                                                    style={{ width: `${member.alive ? memberHealth : 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {isTalking && (
                        <div className="bg-[rgba(74,222,128,0.15)] backdrop-blur-md border border-[#4ADE80]/30 rounded-[10px] px-3 py-2 flex items-center gap-2">
                            <Mic className="w-4 h-4 text-[#4ADE80] animate-pulse" />
                            <span className="text-[#4ADE80] text-xs font-bold tracking-wider">TALKING</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute top-6 right-6 flex flex-col items-end gap-1.5 max-w-[300px]">
                <OnlineCounter count={state.online} maxCount={100} />
                <ShardSwitcher state={shardState ?? null} onSwitch={onSwitchShard ?? (() => { })} />

                {combatRemainingMs > 0 && (
                    <div className="bg-[rgba(248,113,113,0.15)] backdrop-blur-md border border-[#F87171]/40 px-4 py-2 rounded-[10px]">
                        <div className="flex items-center gap-2">
                            <Swords className="w-4 h-4 text-[#F87171]" />
                            <span className="text-[#F87171] text-sm font-bold tracking-wider">
                                IN COMBAT {Math.ceil(combatRemainingMs / 1000)}s
                            </span>
                        </div>
                    </div>
                )}

                {rightRail}
            </div>

            <div
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                style={{ top: TOP_MENU_BAND_PX }}
            >
                {topCenter}

                {spawnProtectionSeconds > 0 && (
                    <div className="bg-[rgba(111,224,255,0.15)] backdrop-blur-md border border-[#6FE0FF]/40 px-5 py-2 rounded-[10px]">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#6FE0FF]" />
                            <span className="text-[#6FE0FF] text-sm font-bold tracking-wider">
                                INVULNERABLE {spawnProtectionSeconds}s
                            </span>
                            <span className="text-[#6FE0FF]/60 text-xs">shoot to cancel</span>
                        </div>
                    </div>
                )}

                {state.inSafeZone && (
                    <div className="bg-[rgba(74,222,128,0.15)] backdrop-blur-md border border-[#4ADE80]/30 px-5 py-2 rounded-[10px]">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-[#4ADE80]" />
                            <span className="text-[#4ADE80] text-sm font-bold tracking-wider">SAFE ZONE</span>
                        </div>
                    </div>
                )}
            </div>

            {state.isWeaponEquipped && (
                <div className="absolute bottom-8 right-8">
                    <div className="bg-[rgba(12,12,14,0.72)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-[10px] p-5 min-w-[180px]">
                        <div className="flex items-baseline justify-between gap-3 mb-2">
                            <span className="text-[#8B8F98] text-xs font-bold tracking-wider uppercase">{state.weaponName}</span>
                            <span className="text-[#4FD1FF] text-[10px] font-bold tracking-wider uppercase">{state.fireMode}</span>
                        </div>

                        {state.weaponKind === "staff" ? (
                            <div className="flex items-baseline gap-3">
                                <span className="text-[#C79AE0] text-4xl font-bold leading-none">MANA</span>
                            </div>
                        ) : (
                            <div className="flex items-baseline gap-3">
                                <span className="text-[#4FD1FF] text-5xl font-bold leading-none">{state.ammo}</span>
                                <div className="flex flex-col">
                                    <div className="h-[2px] bg-[rgba(255,255,255,0.2)] w-12 mb-1" />
                                    <span className="text-[#8B8F98] text-xl font-semibold">{state.maxAmmo}</span>
                                </div>
                            </div>
                        )}

                        {state.chargeProgress > 0 && (
                            <div className="mt-3 h-1 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#C79AE0]"
                                    style={{ width: `${Math.round(state.chargeProgress * 100)}%` }}
                                />
                            </div>
                        )}

                        <div className="mt-3 flex items-center gap-2">
                            {state.isReloading ? (
                                <Activity className="w-4 h-4 text-[#FF5757] animate-pulse" />
                            ) : null}
                            <span className={`text-xs font-medium ${state.isReloading ? 'text-[#FF5757]' : 'text-[#8B8F98]'}`}>
                                {state.isReloading
                                    ? 'RELOADING...'
                                    : state.weaponKind === "staff"
                                        ? 'Press [B] for fire mode'
                                        : 'Press [R] to reload, [B] for fire mode'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {state.inkDarkness > 0 && (
                <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                    style={{ background: "#05050a", opacity: state.inkDarkness }}
                />
            )}

            {state.tunerReadout && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="bg-[rgba(12,12,14,0.9)] border border-[#FFD166]/40 rounded-[8px] px-4 py-2">
                        <div className="text-[#FFD166] text-[10px] font-bold tracking-wider mb-1">
                            WEAPON GRIP TUNER — numpad 4/6 x, 8/2 y, 7/9 z, 1/3 yaw, -/+ pitch, ÷/× roll, 5 logs, 0 exits
                        </div>
                        <div className="text-[#E5E7EB] text-xs font-mono">{state.tunerReadout}</div>
                    </div>
                </div>
            )}

            {state.prompt && (
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
                    <div className="bg-[rgba(12,12,14,0.72)] backdrop-blur-md border border-[#4FD1FF]/40 px-6 py-3 rounded-[10px] shadow-lg shadow-[#4FD1FF]/10">
                        <div className="flex items-center gap-3">
                            <div className="bg-[rgba(79,209,255,0.2)] border border-[#4FD1FF] rounded-md px-3 py-1">
                                <span className="text-[#4FD1FF] text-sm font-bold">E</span>
                            </div>
                            <span className="text-[#4FD1FF] text-sm font-bold tracking-wide">{state.prompt}</span>
                        </div>
                    </div>
                </div>
            )}

            <Crosshair
                visible={isPointerLocked && !state.inSafeZone && state.isWeaponEquipped}
                isHitMark={isHitMark}
            />
        </div>
    );
}