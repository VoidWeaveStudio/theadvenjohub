// src/features/game/world/building/BuildSession.ts
import type { NetworkManager, RoomBuildOp } from "../../network/NetworkManager";
import { BuildEditor, type EditorTool } from "./BuildEditor";
import type { BuildPlot } from "./BuildPlot";
import { pieceKey, type BuildPiece } from "./BuildLayout";
import { getBuildEntry } from "./BuildCatalog";

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
    tool: EditorTool;
    selectionLabel: string | null;
    canPaint: boolean;
    paintAspect: number | null;
    paintUrl: string | null;
    carrying: boolean;
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
            selectionLabel: this.editor.selectionLabel(),
            canPaint: this.editor.selectionPaintable(),
            paintAspect: this.editor.selectionPaintAspect(),
            paintUrl: this.editor.selectionPaintUrl(),
            carrying: this.editor.carrying !== null,
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
            const payload = await res.json().catch(() => null);

            if (!res.ok) {
                this.onNotification?.(
                    res.status === 401
                        ? "🔒 Your session expired — sign in again to load this lot"
                        : "⚠️ Could not load this lot",
                    3000
                );
                return;
            }

            this.canEdit = !!payload?.canEdit;
            if (payload?.data) this.plot.loadLayout(payload.data);
            this.emit();
        } catch {
            this.onNotification?.("⚠️ Could not reach the server to load this lot", 3000);
        }
    }

    public canOpenEditor(): boolean {
        return this.canEdit && this.plot !== null;
    }

    public enter(scene: Parameters<BuildEditor["activate"]>[0]): boolean {
        if (!this.plot || !this.canEdit) return false;

        this.editor.activate(scene, this.plot.layout);
        this.plot.setEditorMode(true);
        this.plot.setViewerOverride(this.editor.camera.focus);
        this.emit();
        return true;
    }

    public exit() {
        if (!this.editor.active) return;
        this.editor.deactivate();
        this.plot?.setEditorMode(false);
        this.plot?.setViewerOverride(null);
        void this.save();
        this.emit();
    }

    public update(delta: number) {
        this.editor.update(delta);
    }

    private place(piece: BuildPiece) {
        if (!this.plot || !this.canEdit) return;

        if (this.plot.blocksStairwell(piece)) {
            this.onNotification?.("🪜 A staircase comes up here — keep this cell open", 2600);
            return;
        }

        for (const key of this.plot.stairwellConflicts(piece)) {
            this.erase(key);
        }

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

    public setTool(tool: EditorTool) {
        this.editor.setTool(tool);
    }

    public setInputSuspended(suspended: boolean) {
        this.editor.suspended = suspended;
        if (suspended) this.editor.releaseKeys();
    }

    public deleteSelection() {
        this.editor.deleteSelection();
    }

    public moveSelection() {
        this.editor.pickUpSelection();
    }

    public rotateSelection() {
        this.editor.rotateSelection();
    }

    public cancelCarry() {
        this.editor.cancelCarry();
    }

    private async uploadPaint(image: Blob): Promise<string> {
        const body = new FormData();
        body.append("file", new File([image], "poster.png", { type: "image/png" }));

        const res = await fetch("/api/game/poster/upload", {
            method: "POST",
            credentials: "include",
            body,
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.url) {
            if (res.status === 401) throw new Error("Your session expired — sign in again");
            throw new Error(payload?.error === "too_many_attempts" ? "Too many uploads, wait a moment" : "Upload failed");
        }

        return payload.url as string;
    }

    public async paintSelection(image: Blob): Promise<void> {
        if (!this.plot || !this.canEdit || !this.editor.selectionPaintable()) {
            throw new Error("Nothing to paint here");
        }

        this.editor.paintSelection(await this.uploadPaint(image));
    }

    public getPaintTarget(key: string): { aspect: number; url: string | null } | null {
        const piece = this.plot?.findPaintable(key);
        if (!piece) return null;

        const spec = getBuildEntry(piece.t)?.paint;
        if (!spec) return null;

        return { aspect: spec.width / spec.height, url: piece.d ?? null };
    }

    public async paintPiece(key: string, image: Blob): Promise<void> {
        if (!this.plot || !this.canEdit) throw new Error("Only the lot owner can draw here");

        const piece = this.plot.findPaintable(key);
        if (!piece) throw new Error("Nothing to paint here");

        const url = await this.uploadPaint(image);
        this.place({ ...piece, d: url });
        await this.save();
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
