//src\features\game\world\locations\tower\TowerRegistry.ts
import { Location } from "../../Location";
import { MainHall } from "./floors/MainHall";
import { Basement } from "./floors/Basement";

export interface TowerFloorConfig {
    id: string;
    name: string;
    locationClass: new () => Location;
    description: string;
    icon: 'building' | 'arrow-down' | 'arrow-up';
}

export const TOWER_FLOORS: TowerFloorConfig[] = [
    {
        id: 'tower-main-hall',
        name: 'Main Hall',
        locationClass: MainHall,
        description: 'Main Hall',
        icon: 'building'
    },
    {
        id: 'tower-basement',
        name: 'Basement',
        locationClass: Basement,
        description: 'MemeTower',
        icon: 'arrow-down'
    }
];