// src/features/game/entities/furniture/WallPoster.ts
import * as THREE from "three";

const BOARD_WIDTH = 1024;
const BOARD_HEIGHT = 640;
const BOARD_3D_WIDTH = 0.9;
const BOARD_3D_HEIGHT = 0.55;
const FRAME_DEPTH = 0.03;
const BOARD_DEPTH = 0.02;

let frameGeometry: THREE.BoxGeometry | null = null;
let frameMaterial: THREE.MeshStandardMaterial | null = null;
let ghostFrameMaterial: THREE.MeshStandardMaterial | null = null;

function getFrameGeometry(): THREE.BoxGeometry {
    if (!frameGeometry) frameGeometry = new THREE.BoxGeometry(BOARD_3D_WIDTH + 0.08, BOARD_3D_HEIGHT + 0.08, FRAME_DEPTH);
    return frameGeometry;
}
function getFrameMaterial(): THREE.MeshStandardMaterial {
    if (!frameMaterial) frameMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.7, metalness: 0.05 });
    return frameMaterial;
}
function getGhostFrameMaterial(): THREE.MeshStandardMaterial {
    if (!ghostFrameMaterial) {
        ghostFrameMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3320, roughness: 0.7, metalness: 0.05, transparent: true, opacity: 0.5,
        });
    }
    return ghostFrameMaterial;
}

export class WallPoster {
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
        if (!ghost) {
            this.mesh.userData.interactionId = `item-${id}`;
            this.mesh.userData.itemId = "wall-poster";
        }

        const frame = new THREE.Mesh(getFrameGeometry(), ghost ? getGhostFrameMaterial() : getFrameMaterial());
        frame.position.z = FRAME_DEPTH / 2;
        this.mesh.add(frame);

        this.boardCanvas = document.createElement("canvas");
        this.boardCanvas.width = BOARD_WIDTH;
        this.boardCanvas.height = BOARD_HEIGHT;
        this.boardCtx = this.boardCanvas.getContext("2d")!;
        this.boardTexture = new THREE.CanvasTexture(this.boardCanvas);

        const boardMat = new THREE.MeshBasicMaterial({ map: this.boardTexture, transparent: ghost, opacity: ghost ? 0.5 : 1 });
        const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD_3D_WIDTH, BOARD_3D_HEIGHT, BOARD_DEPTH), boardMat);
        board.position.z = FRAME_DEPTH + BOARD_DEPTH / 2;
        this.mesh.add(board);

        if (!ghost) {
            const nameSprite = this.createNameSprite(ownerNickname);
            nameSprite.position.z = FRAME_DEPTH + 0.05;
            this.mesh.add(nameSprite);
        }

        this.redrawBoard();
    }

    private createNameSprite(nickname: string): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 72;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFD166";
        ctx.font = "bold 32px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nickname, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.position.y = BOARD_3D_HEIGHT / 2 + 0.16;
        sprite.scale.set(0.8, 0.18, 1);
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
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
