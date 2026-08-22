// src/features/game/ui/Minimap.tsx
"use client";

import { useEffect, useRef } from "react";
import type { Game } from "../core/Game";
import {
    BOMB_SITE_A,
    BOMB_SITE_B,
    CALLOUTS,
    CRATES,
    MAP_HALF_X,
    MAP_HALF_Z,
    PLATFORMS,
    WALLS,
} from "../world/locations/events/dust2Layout";

interface MinimapProps {
    gameRef: React.RefObject<Game | null>;
    active: boolean;
    objective: "A" | "B" | null;
}

const SIZE = 208;
const PAD = 6;

const COLORS = {
    ground: "#1b1712",
    floor: "#3a3128",
    wall: "#7d6a4f",
    platform: "#4b4033",
    crate: "#5d4d38",
    site: "rgba(255,87,87,0.22)",
    siteEdge: "#ff8a8a",
    objective: "#ffd166",
    mate: "#5fa8e8",
    bomb: "#ff5757",
    me: "#ffffff",
};

// The map never moves or rotates: both sites stay on screen, so the map answers
// "where do I go" rather than only "what is around me". One scale for both axes,
// or a navigation aid would be lying about distances.
const SCALE = (SIZE - PAD * 2) / Math.max(MAP_HALF_X, MAP_HALF_Z) / 2;
const ORIGIN_X = SIZE / 2;
const ORIGIN_Y = SIZE / 2;

function project(x: number, z: number): [number, number] {
    return [ORIGIN_X + x * SCALE, ORIGIN_Y + z * SCALE];
}

function buildBackdrop(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const [fx, fy] = project(-MAP_HALF_X, -MAP_HALF_Z);
    const [fx2, fy2] = project(MAP_HALF_X, MAP_HALF_Z);
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(fx, fy, fx2 - fx, fy2 - fy);

    ctx.fillStyle = COLORS.wall;
    for (const wall of WALLS) {
        if ((wall.y ?? 0) > 0.01) continue;
        const [x1, y1] = project(Math.min(wall.x1, wall.x2), Math.min(wall.z1, wall.z2));
        const [x2, y2] = project(Math.max(wall.x1, wall.x2), Math.max(wall.z1, wall.z2));
        ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
    }

    ctx.fillStyle = COLORS.platform;
    for (const pad of PLATFORMS) {
        const [x1, y1] = project(Math.min(pad.x1, pad.x2), Math.min(pad.z1, pad.z2));
        const [x2, y2] = project(Math.max(pad.x1, pad.x2), Math.max(pad.z1, pad.z2));
        ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
    }

    ctx.fillStyle = COLORS.crate;
    for (const crate of CRATES) {
        const [x1, y1] = project(crate.x - crate.width / 2, crate.z - crate.depth / 2);
        const [x2, y2] = project(crate.x + crate.width / 2, crate.z + crate.depth / 2);
        ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
    }

    ctx.font = "600 7px system-ui, sans-serif";
    ctx.fillStyle = "rgba(233,225,208,0.34)";
    ctx.textAlign = "center";
    for (const call of CALLOUTS) {
        if (call.label === "A SITE" || call.label === "B SITE") continue;
        const [x, y] = project(call.x, call.z);
        ctx.fillText(call.label, x, y);
    }

    return canvas;
}

export function Minimap({ gameRef, active, objective }: MinimapProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const backdropRef = useRef<HTMLCanvasElement | null>(null);
    const objectiveRef = useRef(objective);

    objectiveRef.current = objective;

    useEffect(() => {
        if (!active) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (!backdropRef.current) backdropRef.current = buildBackdrop();
        const backdrop = backdropRef.current;

        let frame = 0;
        let stopped = false;

        const draw = () => {
            if (stopped) return;
            frame = requestAnimationFrame(draw);

            const state = gameRef.current?.getMinimapState();
            if (!state) return;

            ctx.clearRect(0, 0, SIZE, SIZE);
            ctx.drawImage(backdrop, 0, 0);

            const goal = objectiveRef.current;
            for (const [site, letter] of [[BOMB_SITE_A, "A"], [BOMB_SITE_B, "B"]] as const) {
                const [sx, sy] = project(site.x, site.z);
                const radius = site.radius * SCALE;
                const highlighted = goal === letter;

                ctx.beginPath();
                ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                ctx.fillStyle = COLORS.site;
                ctx.fill();
                ctx.lineWidth = highlighted ? 2 : 1;
                ctx.strokeStyle = highlighted ? COLORS.objective : COLORS.siteEdge;
                ctx.stroke();

                ctx.font = highlighted ? "900 13px system-ui, sans-serif" : "800 11px system-ui, sans-serif";
                ctx.fillStyle = highlighted ? COLORS.objective : COLORS.siteEdge;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(letter, sx, sy);
            }

            for (const mate of state.mates) {
                const [mx, my] = project(mate.x, mate.z);
                ctx.beginPath();
                ctx.arc(mx, my, 3, 0, Math.PI * 2);
                ctx.fillStyle = mate.alive ? COLORS.mate : "rgba(95,168,232,0.35)";
                ctx.fill();
            }

            if (state.bomb) {
                const [bx, by] = project(state.bomb.x, state.bomb.z);
                ctx.beginPath();
                ctx.arc(bx, by, 4, 0, Math.PI * 2);
                ctx.fillStyle = COLORS.bomb;
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = "#ffffff";
                ctx.stroke();
            }

            const [px, py] = project(state.x, state.z);
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(-state.yaw);
            ctx.beginPath();
            ctx.moveTo(0, -7);
            ctx.lineTo(4.6, 5);
            ctx.lineTo(0, 2.6);
            ctx.lineTo(-4.6, 5);
            ctx.closePath();
            ctx.fillStyle = COLORS.me;
            ctx.fill();
            ctx.restore();
        };

        frame = requestAnimationFrame(draw);
        return () => {
            stopped = true;
            cancelAnimationFrame(frame);
        };
    }, [active, gameRef]);

    if (!active) return null;

    return (
        <div className="absolute top-20 left-3 scale-75 origin-top-left sm:scale-100 sm:top-auto sm:bottom-6 sm:left-6 pointer-events-none select-none z-30">
            <canvas
                ref={canvasRef}
                width={SIZE}
                height={SIZE}
                className="rounded-[10px] border border-white/15 bg-[rgba(10,12,16,0.86)] backdrop-blur-md"
            />
        </div>
    );
}
