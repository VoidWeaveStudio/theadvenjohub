//src\features\game\utils\UsernameSprite.ts
import * as THREE from 'three';

export class UsernameSprite {
    static create(username: string, color: number = 0x00ffff): THREE.Sprite {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;

        const context = canvas.getContext('2d')!;
        UsernameSprite.drawText(context, username, color);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 0.5, 1);
        sprite.position.y = 2.5;
        sprite.renderOrder = 999;

        sprite.userData.canvas = canvas;
        sprite.userData.context = context;

        return sprite;
    }

    static update(sprite: THREE.Sprite, username: string, color: number = 0x00ffff): void {
        const context = sprite.userData.context as CanvasRenderingContext2D | undefined;
        if (!context) return;

        context.clearRect(0, 0, 256, 64);
        UsernameSprite.drawText(context, username, color);

        const material = sprite.material as THREE.SpriteMaterial;
        if (material.map) material.map.needsUpdate = true;
    }

    private static drawText(context: CanvasRenderingContext2D, username: string, color: number): void {
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, 256, 64);

        const hexColor = `#${color.toString(16).padStart(6, '0')}`;
        context.strokeStyle = hexColor;
        context.lineWidth = 2;
        context.strokeRect(1, 1, 254, 62);

        context.fillStyle = hexColor;
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(username, 128, 32);
    }
}