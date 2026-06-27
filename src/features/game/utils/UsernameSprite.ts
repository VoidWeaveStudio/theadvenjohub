//src\features\game\utils\UsernameSprite.ts
import * as THREE from 'three';

export class UsernameSprite {
    static create(username: string, color: number = 0x00ffff): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        if (context) {
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);

            context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
            context.lineWidth = 4;
            context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

            context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
            context.font = 'bold 48px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(username, canvas.width / 2, canvas.height / 2);
        }

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

        return sprite;
    }

    static update(sprite: THREE.Sprite, username: string, color: number = 0x00ffff): void {
        const material = sprite.material as THREE.SpriteMaterial;
        if (material.map) {
            material.map.dispose();
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        if (context) {
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);

            context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
            context.lineWidth = 4;
            context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

            context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
            context.font = 'bold 48px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(username, canvas.width / 2, canvas.height / 2);
        }

        const texture = new THREE.CanvasTexture(canvas);
        material.map = texture;
        material.needsUpdate = true;
    }
}