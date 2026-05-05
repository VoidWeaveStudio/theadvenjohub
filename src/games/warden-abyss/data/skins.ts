//src\games\warden-abyss\data\skins.ts
export interface Skin {
  id: string;
  nameKey: string;
  descriptionKey: string;
  bonusPercent: number;
  baseCost: number;
  owned: boolean;
  color: string;
  rarity?: "common" | "legendary";
}

export const calculateSkinCost = (baseCost: number): number => {
  return baseCost;
};

export const SKINS: Skin[] = [
  { 
    id: "default", 
    nameKey: "skins.default.name", 
    descriptionKey: "skins.default.description", 
    bonusPercent: 0, 
    baseCost: 0, 
    owned: true, 
    color: "#52525b", 
    rarity: "common" 
  },
  { 
    id: "crimson", 
    nameKey: "skins.crimson.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 150, 
    owned: false, 
    color: "#b91c1c", 
    rarity: "common" 
  },
  { 
    id: "void", 
    nameKey: "skins.void.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 400, 
    owned: false, 
    color: "#7c3aed", 
    rarity: "common" 
  },
  { 
    id: "shadow", 
    nameKey: "skins.shadow.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 1_000, 
    owned: false, 
    color: "#18181b", 
    rarity: "common" 
  },
  { 
    id: "abyssal", 
    nameKey: "skins.abyssal.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 2_500, 
    owned: false, 
    color: "#0f172a", 
    rarity: "common" 
  },
  { 
    id: "spectral", 
    nameKey: "skins.spectral.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 6_000, 
    owned: false, 
    color: "#94a3b8", 
    rarity: "common" 
  },
  { 
    id: "infernal", 
    nameKey: "skins.infernal.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 14_000, 
    owned: false, 
    color: "#dc2626", 
    rarity: "common" 
  },
  { 
    id: "celestial", 
    nameKey: "skins.celestial.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 32_000, 
    owned: false, 
    color: "#60a5fa", 
    rarity: "common" 
  },
  { 
    id: "primordial", 
    nameKey: "skins.primordial.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 75_000, 
    owned: false, 
    color: "#f59e0b", 
    rarity: "common" 
  },
  { 
    id: "divine", 
    nameKey: "skins.divine.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 170_000, 
    owned: false, 
    color: "#fbbf24", 
    rarity: "common" 
  },
  { 
    id: "ethereal", 
    nameKey: "skins.ethereal.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 380_000, 
    owned: false, 
    color: "#a855f7", 
    rarity: "common" 
  },
  { 
    id: "phantom", 
    nameKey: "skins.phantom.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 850_000, 
    owned: false, 
    color: "#64748b", 
    rarity: "common" 
  },
  { 
    id: "storm", 
    nameKey: "skins.storm.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 1_900_000, 
    owned: false, 
    color: "#0ea5e9", 
    rarity: "common" 
  },
  { 
    id: "frost", 
    nameKey: "skins.frost.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 4_200_000, 
    owned: false, 
    color: "#38bdf8", 
    rarity: "common" 
  },
  { 
    id: "venom", 
    nameKey: "skins.venom.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 9_500_000, 
    owned: false, 
    color: "#84cc16", 
    rarity: "common" 
  },
  { 
    id: "arcane", 
    nameKey: "skins.arcane.name", 
    descriptionKey: "skins.damage_bonus.description", 
    bonusPercent: 10, 
    baseCost: 20_000_000, 
    owned: false, 
    color: "#ec4899", 
    rarity: "common" 
  },
  { 
    id: "god_slayer", 
    nameKey: "skins.god_slayer.name", 
    descriptionKey: "skins.legendary.description", 
    bonusPercent: 50, 
    baseCost: 1_000_000, 
    owned: false, 
    color: "#f59e0b", 
    rarity: "legendary" 
  },
  { 
    id: "world_eater", 
    nameKey: "skins.world_eater.name", 
    descriptionKey: "skins.legendary.description", 
    bonusPercent: 100, 
    baseCost: 1_500_000, 
    owned: false, 
    color: "#ef4444", 
    rarity: "legendary" 
  },
  { 
    id: "chronos", 
    nameKey: "skins.chronos.name", 
    descriptionKey: "skins.legendary.description", 
    bonusPercent: 150, 
    baseCost: 2_500_000, 
    owned: false, 
    color: "#3b82f6", 
    rarity: "legendary" 
  },
  { 
    id: "omega", 
    nameKey: "skins.omega.name", 
    descriptionKey: "skins.legendary.description", 
    bonusPercent: 200, 
    baseCost: 4_000_000, 
    owned: false, 
    color: "#8b5cf6", 
    rarity: "legendary" 
  },
  { 
    id: "singularity", 
    nameKey: "skins.singularity.name", 
    descriptionKey: "skins.legendary.description", 
    bonusPercent: 250, 
    baseCost: 5_000_000, 
    owned: false, 
    color: "#ffffff", 
    rarity: "legendary" 
  },
];