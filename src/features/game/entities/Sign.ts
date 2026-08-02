// src/features/game/entities/Sign.ts
import * as THREE from "three";

const BOARD_WIDTH = 1024;
const BOARD_HEIGHT = 640;

export class Sign {
    public readonly id: string;
    public readonly mesh: THREE.Group;
    public ownerId: string;
    public ownerNickname: string;
    public contentType: "text" | "draw" | null;
    public textContent: string | null;
    public drawingUrl: string | null;

    private boardCanvas: HTMLCanvasElement;
    private boardCtx: CanvasRenderingContext2D;
    private boardTexture: THREE.CanvasTexture;

    constructor(
        id: string,
        ownerId: string,
        ownerNickname: string,
        contentType: "text" | "draw" | null,
        textContent: string | null,
        drawingUrl: string | null,
        ghost: boolean = false
    ) {
        this.id = id;
        this.ownerId = ownerId;
        this.ownerNickname = ownerNickname;
        this.contentType = contentType;
        this.textContent = textContent;
        this.drawingUrl = drawingUrl;

        this.mesh = new THREE.Group();
        this.mesh.userData.interactionId = `sign-${id}`;

        const BOARD_Y = 1.15;
        const BOARD_HEIGHT_3D = 0.55;
        const boardBottom = BOARD_Y - BOARD_HEIGHT_3D / 2;

        const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, transparent: ghost, opacity: ghost ? 0.5 : 1 });
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, boardBottom, 8), postMat);
        post.position.y = boardBottom / 2;
        this.mesh.add(post);

        this.boardCanvas = document.createElement("canvas");
        this.boardCanvas.width = BOARD_WIDTH;
        this.boardCanvas.height = BOARD_HEIGHT;
        this.boardCtx = this.boardCanvas.getContext("2d")!;
        this.boardTexture = new THREE.CanvasTexture(this.boardCanvas);

        const boardMat = new THREE.MeshBasicMaterial({ map: this.boardTexture, transparent: ghost, opacity: ghost ? 0.5 : 1 });
        const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, BOARD_HEIGHT_3D, 0.05), boardMat);
        boardMesh.position.y = BOARD_Y;
        this.mesh.add(boardMesh);

        if (!ghost) {
            this.mesh.add(this.createNameSprite(ownerNickname));
        }

        this.redrawBoard();
    }

    private createNameSprite(nickname: string): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 384;
        canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFD166";
        ctx.font = "bold 40px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nickname, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.position.y = 1.65;
        sprite.scale.set(1.5, 0.375, 1);
        return sprite;
    }

    private wrapText(text: string, cx: number, cy: number, maxWidth: number, lineHeight: number) {
        const ctx = this.boardCtx;
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let line = "";
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);

        const startY = cy - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
    }

    private redrawBoard() {
        const ctx = this.boardCtx;
        const canvas = this.boardCanvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#E8D5B5";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#6b4a2f";
        ctx.lineWidth = 16;
        ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

        if (this.contentType === "text" && this.textContent) {
            ctx.fillStyle = "#2b1c10";
            ctx.font = "bold 44px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            this.wrapText(this.textContent, canvas.width / 2, canvas.height / 2, canvas.width - 100, 54);
            this.boardTexture.needsUpdate = true;
        } else if (this.contentType === "draw" && this.drawingUrl) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                ctx.drawImage(img, 24, 24, canvas.width - 48, canvas.height - 48);
                this.boardTexture.needsUpdate = true;
            };
            img.src = this.drawingUrl;
        }
        this.boardTexture.needsUpdate = true;
    }

    public updateContent(contentType: "text" | "draw", textContent: string | null, drawingUrl: string | null) {
        this.contentType = contentType;
        this.textContent = textContent;
        this.drawingUrl = drawingUrl;
        this.redrawBoard();
    }

    public dispose(scene: THREE.Scene) {
        scene.remove(this.mesh);
        this.boardTexture.dispose();
    }
}
