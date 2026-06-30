// src/features/game/components/Reticle.tsx
import React, { useMemo } from 'react';

interface ReticleProps {
    mode?: 'shooter' | 'fishing' | 'racing' | 'magic' | 'default';
    size?: number;
    color?: string;
    opacity?: number;
    visible?: boolean;
}

const reticleContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 1000,
};

const shooterReticleStyle = (size: number, color: string, opacity: number): React.CSSProperties => ({
    width: size,
    height: size,
    border: `2px solid ${color}`,
    borderRadius: '50%',
    opacity,
    position: 'relative',
    boxSizing: 'border-box',
});

const crosshairVerticalStyle = (color: string, opacity: number, height: number): React.CSSProperties => ({
    position: 'absolute',
    backgroundColor: color,
    opacity,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 4,
    height: height,
});

const crosshairHorizontalStyle = (color: string, opacity: number, width: number): React.CSSProperties => ({
    position: 'absolute',
    backgroundColor: color,
    opacity,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: width,
    height: 4,
});

const fishingReticleStyle = (size: number, color: string, opacity: number): React.CSSProperties => ({
    width: 0,
    height: 0,
    borderLeft: `${size / 2}px solid transparent`,
    borderRight: `${size / 2}px solid transparent`,
    borderTop: `${size}px solid ${color}`,
    opacity,
});

const racingReticleStyle = (size: number, color: string, opacity: number): React.CSSProperties => ({
    width: size,
    height: size / 3,
    backgroundColor: color,
    opacity,
    borderRadius: size / 6,
});

const magicReticleStyle = (size: number, color: string, opacity: number): React.CSSProperties => ({
    width: size,
    height: size,
    border: `2px solid ${color}`,
    borderRadius: '50%',
    opacity,
    position: 'relative',
    animation: 'pulse 2s infinite',
});

const defaultReticleStyle = (size: number, color: string, opacity: number): React.CSSProperties => ({
    width: size,
    height: size,
    border: `2px solid ${color}`,
    borderRadius: '50%',
    opacity,
    boxSizing: 'border-box',
});

export const Reticle: React.FC<ReticleProps> = ({
    mode = 'default',
    size = 32,
    color = '#ffffff',
    opacity = 0.8,
    visible = true
}) => {
    const renderReticle = useMemo(() => {
        switch (mode) {
            case 'shooter':
                return (
                    <div style={shooterReticleStyle(size, color, opacity)}>
                        <div style={crosshairVerticalStyle(color, opacity, size / 3)} />
                        <div style={crosshairHorizontalStyle(color, opacity, size / 3)} />
                    </div>
                );
            case 'fishing':
                return <div style={fishingReticleStyle(size, color, opacity)} />;
            case 'racing':
                return <div style={racingReticleStyle(size, color, opacity)} />;
            case 'magic':
                return <div style={magicReticleStyle(size, color, opacity)} />;
            default:
                return <div style={defaultReticleStyle(size, color, opacity)} />;
        }
    }, [mode, size, color, opacity]);

    return (
        <div style={{...reticleContainerStyle, opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease'}}>
            {renderReticle}
        </div>
    );
};