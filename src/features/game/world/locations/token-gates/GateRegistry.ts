export interface GateConfig {
    id: string;
    ca: string | null;
    targetLocationId: string;
    name: string;
    description: string;
    customModule?: string;
}

export const GATE_REGISTRY: GateConfig[] = [];

for (let i = 1; i <= 39; i++) {
    GATE_REGISTRY.push({
        id: `token-gate-${i.toString().padStart(2, '0')}`,
        ca: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
        targetLocationId: `canyon-token-${i.toString().padStart(2, '0')}`,
        name: `Token Canyon ${i}`,
        description: `Dedicated to Token ${i}`,
    });
}

export function getGateConfig(id: string): GateConfig | undefined {
    return GATE_REGISTRY.find(g => g.id === id);
}