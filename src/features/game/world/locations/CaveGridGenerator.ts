// src/features/game/world/locations/CaveGridGenerator.ts
export function generateCaveMap(mapSize: number): number[][] {
    const size = mapSize;
    const caveMap: number[][] = [];
    for (let x = 0; x < size; x++) {
        caveMap[x] = [];
        for (let z = 0; z < size; z++) {
            caveMap[x][z] = 0;
        }
    }

    const rooms = [
        { x: 13, z: 13, w: 5, h: 5 },
        { x: 3, z: 3, w: 5, h: 4 },
        { x: 22, z: 3, w: 5, h: 4 },
        { x: 3, z: 23, w: 5, h: 4 },
        { x: 22, z: 23, w: 5, h: 4 },
        { x: 13, z: 3, w: 4, h: 3 },
        { x: 13, z: 24, w: 4, h: 3 },
        { x: 3, z: 13, w: 3, h: 4 },
        { x: 24, z: 13, w: 3, h: 4 },
        { x: 8, z: 8, w: 3, h: 3 },
        { x: 19, z: 8, w: 3, h: 3 },
        { x: 8, z: 19, w: 3, h: 3 },
        { x: 19, z: 19, w: 3, h: 3 },
    ];

    for (const room of rooms) {
        for (let x = room.x; x < room.x + room.w; x++) {
            for (let z = room.z; z < room.z + room.h; z++) {
                if (x >= 0 && x < size && z >= 0 && z < size) {
                    caveMap[x][z] = 1;
                }
            }
        }
    }

    const connections = [
        [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8],
        [1, 9], [2, 10], [3, 11], [4, 12],
        [9, 5], [10, 5], [11, 6], [12, 6],
        [9, 7], [10, 8], [11, 7], [12, 8],
        [1, 7], [2, 8], [3, 7], [4, 8],
    ];

    for (const [a, b] of connections) {
        const ra = rooms[a], rb = rooms[b];
        const cx1 = Math.floor(ra.x + ra.w / 2);
        const cz1 = Math.floor(ra.z + ra.h / 2);
        const cx2 = Math.floor(rb.x + rb.w / 2);
        const cz2 = Math.floor(rb.z + rb.h / 2);

        let x = cx1, z = cz1;
        while (x !== cx2) {
            if (x >= 0 && x < size && z >= 0 && z < size) caveMap[x][z] = 1;
            x += x < cx2 ? 1 : -1;
        }
        while (z !== cz2) {
            if (x >= 0 && x < size && z >= 0 && z < size) caveMap[x][z] = 1;
            z += z < cz2 ? 1 : -1;
        }
    }

    return caveMap;
}

function smoothHeights(
    caveMap: number[][],
    mapSize: number,
    floorHeights: number[][],
    ceilingHeights: number[][]
): { floorHeights: number[][]; ceilingHeights: number[][] } {
    const iterations = 3;
    for (let iter = 0; iter < iterations; iter++) {
        const newFloors = floorHeights.map(row => [...row]);
        const newCeilings = ceilingHeights.map(row => [...row]);

        for (let x = 1; x < mapSize - 1; x++) {
            for (let z = 1; z < mapSize - 1; z++) {
                if (caveMap[x][z] === 1) {
                    let floorSum = 0, ceilingSum = 0, count = 0;
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dz = -1; dz <= 1; dz++) {
                            if (caveMap[x + dx][z + dz] === 1) {
                                floorSum += floorHeights[x + dx][z + dz];
                                ceilingSum += ceilingHeights[x + dx][z + dz];
                                count++;
                            }
                        }
                    }
                    if (count > 0) {
                        newFloors[x][z] = floorSum / count;
                        newCeilings[x][z] = ceilingSum / count;
                    }
                }
            }
        }
        floorHeights = newFloors;
        ceilingHeights = newCeilings;
    }

    return { floorHeights, ceilingHeights };
}

export function generateHeights(caveMap: number[][], mapSize: number): { floorHeights: number[][]; ceilingHeights: number[][] } {
    let floorHeights: number[][] = [];
    let ceilingHeights: number[][] = [];
    for (let x = 0; x < mapSize; x++) {
        floorHeights[x] = [];
        ceilingHeights[x] = [];
        for (let z = 0; z < mapSize; z++) {
            if (caveMap[x][z] === 1) {
                const baseHeight = (Math.random() - 0.5) * 2;
                floorHeights[x][z] = baseHeight;
                ceilingHeights[x][z] = baseHeight + 12;
            } else {
                floorHeights[x][z] = -5;
                ceilingHeights[x][z] = 15;
            }
        }
    }

    return smoothHeights(caveMap, mapSize, floorHeights, ceilingHeights);
}
