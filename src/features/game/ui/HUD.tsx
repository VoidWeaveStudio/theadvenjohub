// src/features/game/ui/HUD.tsx
import { HUDState } from "../core/Game";
import { Crosshair } from "./Crosshair";
import { OnlineCounter } from "./OnlineCounter";
import { Heart, Shield, Activity } from "lucide-react";

interface HUDProps {
    state: HUDState;
    isPointerLocked: boolean;
    isHitMark?: boolean;
}

export function HUD({ state, isPointerLocked, isHitMark = false }: HUDProps) {
    const healthPercentage = (state.health / state.maxHealth) * 100;

    return (
        <div className="absolute inset-0 pointer-events-none select-none font-oxanium">
            {/* Health Bar - Top Left */}
            <div className="absolute top-6 left-6">
                <div className="flex items-end gap-3">
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
                </div>
            </div>

            <div className="absolute top-6 right-6">
                <OnlineCounter count={state.online} maxCount={100} />
            </div>

            {state.inSafeZone && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2">
                    <div className="bg-[rgba(74,222,128,0.15)] backdrop-blur-md border border-[#4ADE80]/30 px-5 py-2 rounded-[10px]">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-[#4ADE80]" />
                            <span className="text-[#4ADE80] text-sm font-bold tracking-wider">SAFE ZONE</span>
                        </div>
                    </div>
                </div>
            )}

            {state.isWeaponEquipped && (
                <div className="absolute bottom-8 right-8">
                    <div className="bg-[rgba(12,12,14,0.72)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-[10px] p-5 min-w-[180px]">
                        <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-2">ASSAULT RIFLE</div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-[#4FD1FF] text-5xl font-bold leading-none">{state.ammo}</span>
                            <div className="flex flex-col">
                                <div className="h-[2px] bg-[rgba(255,255,255,0.2)] w-12 mb-1" />
                                <span className="text-[#8B8F98] text-xl font-semibold">{state.maxAmmo}</span>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            {state.isReloading ? (
                                <Activity className="w-4 h-4 text-[#FF5757] animate-pulse" />
                            ) : null}
                            <span className={`text-xs font-medium ${state.isReloading ? 'text-[#FF5757]' : 'text-[#8B8F98]'}`}>
                                {state.isReloading ? 'RELOADING...' : 'Press [R] to reload'}
                            </span>
                        </div>
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