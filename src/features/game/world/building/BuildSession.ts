// src/features/game/world/building/BuildSession.ts
import type { NetworkManager, RoomBuildOp } from "../../network/NetworkManager";
import { BuildEditor } from "./BuildEditor";
import type { BuildPlot } from "./BuildPlot";
import { pieceKey, type BuildPiece } from "./BuildLayout";

export type LotOwnerType = "personal" | "faction";

export interface LotIdentity {
    ownerType: LotOwnerType;
    ownerId: string;
}

export interface BuildSessionState {
    active: boolean;
    canEdit: boolean;
    selectedType: string | null;
    rotation: number;
    level: number;
    tool: "place" | "erase";
    saving: boolean;
    dirty: boolean;
    sky: string;
    light: string;
}

export class BuildSession {
    public readonly editor: BuildEditor;

    private plot: BuildPlot | null = null;
    private identity: LotIdentity | null = null;
    private canEdit = false;
    private dirty = false;
    private saving = false;

    public onStateChange: ((state: BuildSessionState) => void) | null = null;
    public onNotification: ((message: string, duration?: number) => void) | null = null;
    public onRequestExit: (() => void) | null = null;

    constructor(aspect: number, private network: NetworkManager, private slug: string) {
        this.editor = new BuildEditor(aspect, {
            onPlace: (piece) => this.place(piece),
            onErase: (key) => this.erase(key),
            onStateChange: () => this.emit(),
            onRequestExit: () => this.onRequestExit?.(),
        });
    }

    public attach(canvas: HTMLCanvasElement) {
        this.editor.attach(canvas);
    }

    public getState(): BuildSessionState {
        return {
            active: this.editor.active,
            canEdit: this.canEdit,
            selectedType: this.editor.selectedType,
            rotation: this.editor.rotation,
            level: this.editor.level,
            tool: this.editor.tool,
            saving: this.saving,
            dirty: this.dirty,
            sky: this.plot?.layout.environment.sky ?? "day",
            light: this.plot?.layout.environment.light ?? "noon",
        };
    }

    private emit() {
        this.onStateChange?.(this.getState());
    }

    public bindLot(plot: BuildPlot, identity: LotIdentity) {
        this.plot = plot;
        this.identity = identity;
        this.canEdit = false;
        this.dirty = false;
        this.emit();
        void this.loadLayout();
    }

    public unbindLot() {
        if (this.editor.active) this.exit();
        this.plot = null;
        this.identity = null;
        this.canEdit = false;
        this.emit();
    }

    private async loadLayout() {
        if (!this.plot || !this.identity) return;

        const params = new URLSearchParams({
            ownerType: this.identity.ownerType,
            ownerId: this.identity.ownerId,
            slug: this.slug,
        });

        try {
            const res = await fetch(`/api/game/room-layout?${params.toString()}`, { credentials: "include" });
            const payload = await res.json();
            if (!res.ok) return;

            this.canEdit = !!payload.canEdit;
            if (payload.data) this.plot.loadLayout(payload.data);
            this.emit();
        } catch {
            return;
        }
    }

    public canOpenEditor(): boolean {
        return this.canEdit && this.plot !== null;
    }

    public enter(scene: Parameters<BuildEditor["activate"]>[0]): boolean {
        if (!this.plot || !this.canEdit) return false;

        this.editor.activate(scene, this.plot.layout);
        this.plot.setEditorMode(true);
        this.emit();
        return true;
    }

    public exit() {
        if (!this.editor.active) return;
        this.editor.deactivate();
        this.plot?.setEditorMode(false);
        void this.save();
        this.emit();
    }

    public update(delta: number) {
        this.editor.update(delta);
    }

    private place(piece: BuildPiece) {
        if (!this.plot || !this.canEdit) return;
        if (!this.plot.placePiece(piece)) return;

        this.dirty = true;
        this.network.sendRoomBuildOp({ kind: "place", piece });
        this.emit();
    }

    private erase(key: string) {
        if (!this.plot || !this.canEdit) return;
        if (!this.plot.erasePiece(key)) return;

        this.dirty = true;
        this.network.sendRoomBuildOp({ kind: "erase", key });
        this.emit();
    }

    public setEnvironment(sky: string, light: string) {
        if (!this.plot || !this.canEdit) return;

        this.plot.setEnvironment(sky, light);
        this.dirty = true;
        this.network.sendRoomBuildOp({ kind: "env", sky, light });
        this.emit();
    }

    public clearLot() {
        if (!this.plot || !this.canEdit) return;

        this.plot.layout.clear();
        this.plot.renderer.markAll();
        this.plot.renderer.flush();
        this.dirty = true;
        this.network.sendRoomBuildOp({ kind: "clear" });
        this.emit();
    }

    public applyRemoteOp(op: RoomBuildOp) {
        if (!this.plot) return;

        if (op.kind === "place") {
            this.plot.placePiece(op.piece);
        } else if (op.kind === "erase") {
            this.plot.erasePiece(op.key);
        } else if (op.kind === "env") {
            this.plot.setEnvironment(op.sky, op.light);
        } else if (op.kind === "clear") {
            this.plot.layout.clear();
            this.plot.renderer.markAll();
            this.plot.renderer.flush();
        }
        this.emit();
    }

    public async save(): Promise<boolean> {
        if (!this.plot || !this.identity || !this.canEdit || !this.dirty) return false;

        this.saving = true;
        this.emit();

        try {
            const { getCsrfToken } = await import("@/core/lib/clientUtils");
            const csrfToken = getCsrfToken();

            const res = await fetch("/api/game/room-layout", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
                },
                body: JSON.stringify({
                    ownerType: this.identity.ownerType,
                    ownerId: this.identity.ownerId,
                    slug: this.slug,
                    data: this.plot.exportLayout(),
                }),
            });

            if (!res.ok) {
                this.onNotification?.("⚠️ Could not save the lot", 2500);
                return false;
            }

            this.dirty = false;
            this.onNotification?.("💾 Lot saved", 1800);
            return true;
        } catch {
            this.onNotification?.("⚠️ Could not save the lot", 2500);
            return false;
        } finally {
            this.saving = false;
            this.emit();
        }
    }

    public selectType(typeId: string | null) {
        this.editor.setSelectedType(typeId);
    }

    public setTool(tool: "place" | "erase") {
        this.editor.setTool(tool);
    }

    public setLevel(level: number) {
        this.editor.setLevel(level);
    }

    public rotate() {
        this.editor.rotation = (this.editor.rotation + 1) % 4;
        this.emit();
    }

    public keyOf(piece: BuildPiece): string {
        return pieceKey(piece);
    }

    public dispose() {
        this.editor.dispose();
        this.plot = null;
        this.identity = null;
    }
}
