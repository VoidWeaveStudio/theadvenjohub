//src\features\game\utils\UsernameSprite.ts
import * as THREE from 'three';

export class UsernameSprite {
    static create(username: string, color: number = 0x00ffff): THREE.Sprite {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;

        const context = canvas.getContext('2d')!;
        UsernameSprite.drawText(context, username, color);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(4, 1, 1);
        sprite.position.y = 2.5;
        sprite.renderOrder = 999;

        sprite.userData.canvas = canvas;
        sprite.userData.context = context;

        return sprite;
    }

    static update(sprite: THREE.Sprite, username: string, color: number = 0x00ffff): void {
        const context = sprite.userData.context as CanvasRenderingContext2D | undefined;
        if (!context) return;

        context.clearRect(0, 0, 512, 128);

        UsernameSprite.drawText(context, username, color);

        const material = sprite.material as THREE.SpriteMaterial;
        if (material.map) material.map.needsUpdate = true;
    }

    private static drawText(context: CanvasRenderingContext2D, username: string, color: number): void {
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, 512, 128);

        const hexColor = `#${color.toString(16).padStart(6, '0')}`;
        context.strokeStyle = hexColor;
        context.lineWidth = 4;
        context.strokeRect(2, 2, 508, 124);

        context.fillStyle = hexColor;
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(username, 256, 64);
    }
}