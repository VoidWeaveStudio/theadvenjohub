// src/features/game/world/locations/showcase/rooms/moon/moonScript.ts
import * as THREE from "three";
import type { SceneTimeline } from "../../scene/SceneTimeline";
import {
    CREW_LOOK_UP,
    MEET_SPOT,
    MEET_SPOT_B,
    NEIGHBOUR_MATE,
    NEIGHBOUR_SPOT,
    TEAM_SPOT_A,
    TEAM_SPOT_B,
    armSpot,
    cabinDoorSpot,
    cageDoor,
    cageStand,
    cageStandWorld,
    crewSeat,
    hatchSpot,
    padFoot,
    towerDeck,
} from "./moonLayout";

export const TOUCHDOWN_TIME = 14;

const SPEAKERS = {
    commander: "COMMANDER",
    walter: "WALTER",
    neighbour: "PEPE CREW",
    radio: "RADIO",
    field: "THE FIELD",
};

export function buildMoonScript(t: SceneTimeline): void {
    const say = (speaker: string, actor: string | undefined, text: string, start: number, duration: number) =>
        t.line(speaker, text, start, duration, actor);

    const shout = (text: string, start: number, duration: number) =>
        t.line(SPEAKERS.field, text, start, duration, undefined, true);

    const commanderSeat = crewSeat("commander");
    const walterSeat = crewSeat("walter");
    const cabinDoor = cabinDoorSpot();
    const hatch = hatchSpot();
    const arm = armSpot();
    const deck = towerDeck();
    const cageTopCommander = cageStandWorld("commander", true);
    const cageTopWalter = cageStandWorld("walter", true);
    const cageLowCommander = cageStandWorld("commander", false);
    const cageLowWalter = cageStandWorld("walter", false);
    const door = cageDoor();
    const foot = padFoot();

    const meetLook = new THREE.Vector3(NEIGHBOUR_SPOT.x, 1.6, NEIGHBOUR_SPOT.z);
    const crewLook = new THREE.Vector3(MEET_SPOT.x, 1.6, MEET_SPOT.z);
    const teamLook = new THREE.Vector3(TEAM_SPOT_A.x, 1.6, TEAM_SPOT_A.z);

    t.state("mount.commander", 2, 0);
    t.state("mount.walter", 2, 0);
    t.state("hatch", 0, 0);
    t.state("arm", 1, 0);
    t.state("cage", 1, 0);
    t.state("rocket.lift", 1, 0);
    t.state("rocket.blast", 0.95, 0);
    t.state("dust", 0, 0);
    t.state("galaxy", 0, 0);
    t.state("field.busy", 0, 0);
    t.state("neighbour.blast", 0, 0);
    t.state("neighbour.lift", 0, 0);

    t.hold("commander", commanderSeat, 0, 18.2, { pose: "sit", facing: Math.PI });
    t.hold("walter", walterSeat, 0, 19.6, { pose: "sit", facing: Math.PI });
    t.move("commander", commanderSeat, cabinDoor, 18.2, 2.8, { linear: true });
    t.move("walter", walterSeat, cabinDoor, 19.6, 2.8, { linear: true });
    t.hold("neighbour", NEIGHBOUR_SPOT, 0, 44, { pose: "work", face: meetLook });
    t.hold("neighbourMate", NEIGHBOUR_MATE, 0, 104, { pose: "work", face: meetLook });
    t.hold("teamA", TEAM_SPOT_A, 0, 104, { pose: "gawk", face: crewLook });
    t.hold("teamB", TEAM_SPOT_B, 0, 104, { pose: "carry", face: crewLook });

    t.ramp("rocket.lift", 1, 0, 0, TOUCHDOWN_TIME);
    t.ramp("dust", 0, 1, TOUCHDOWN_TIME - 5, 5);

    say(SPEAKERS.commander, "commander", "TOUCHDOWN IN TEN. HOLD ON TO SOMETHING.", 2.4, 4);
    say(SPEAKERS.walter, "walter", "I AM HOLDING. I HAVE BEEN HOLDING FOR TWO YEARS.", 7.4, 4.6);

    t.ramp("rocket.blast", 0.95, 0, TOUCHDOWN_TIME, 1.4);
    t.ramp("dust", 1, 0, TOUCHDOWN_TIME + 1.6, 6);
    t.ramp("hatch", 0, 1, TOUCHDOWN_TIME + 2.4, 1.8);
    t.ramp("arm", 1, 0, TOUCHDOWN_TIME + 3.4, 4);

    t.state("mount.commander", 0, 22.4);
    t.state("mount.walter", 0, 23.8);
    t.move("commander", hatch, arm, 22.4, 3, { linear: true });
    t.move("walter", hatch, arm, 23.8, 3, { linear: true });
    t.move("commander", arm, deck, 25.6, 2.6);
    t.move("walter", arm, deck, 27, 2.6);
    t.move("commander", deck, cageTopCommander, 28.4, 2.2);
    t.move("walter", deck, cageTopWalter, 29.8, 2.2);

    t.state("mount.commander", 1, 31);
    t.state("mount.walter", 1, 31);
    t.hold("commander", cageStand("commander"), 31, 9.4, { facing: -Math.PI / 2 });
    t.hold("walter", cageStand("walter"), 31, 9.4, { facing: -Math.PI / 2 });
    t.ramp("cage", 1, 0, 31.4, 8.6);

    t.state("mount.commander", 0, 40.4);
    t.state("mount.walter", 0, 41.4);
    t.move("commander", cageLowCommander, door, 40.4, 1.6, { linear: true });
    t.move("walter", cageLowWalter, door, 41.4, 1.6, { linear: true });
    t.move("commander", door, foot, 42.2, 2);
    t.move("walter", door, foot, 43.2, 2);
    t.move("commander", foot, MEET_SPOT, 44.4, 7);
    t.move("walter", foot, MEET_SPOT_B, 45.6, 7);

    t.hold("commander", MEET_SPOT, 51.6, 28.4, { face: meetLook });
    t.hold("walter", MEET_SPOT_B, 52.8, 54.2, { pose: "gawk", face: meetLook });

    say(SPEAKERS.walter, "walter", "WHAT IS GOING ON HERE? AREN'T WE ON THE MOON?", 52.8, 4.4);

    t.hold("neighbour", NEIGHBOUR_SPOT, 44, 24, { face: crewLook });
    say(SPEAKERS.neighbour, "neighbour", "WE ARE ON THE MOON, FRIEND.", 57.6, 2.8);
    say(SPEAKERS.neighbour, "neighbour", "BUT WHY WOULD ANYONE STAY HERE IF YOU CAN GO FURTHER?", 61, 4.6);
    say(SPEAKERS.commander, "commander", "AND WHAT IS FURTHER?", 66.2, 2.6);
    say(SPEAKERS.neighbour, "neighbour", "NOBODY KNOWS. THAT IS EXACTLY WHY WE ARE GOING.", 69.4, 4.4);

    t.hold("neighbour", NEIGHBOUR_SPOT, 68, 36, { pose: "point", face: crewLook });
    say(SPEAKERS.neighbour, "neighbour", "THE MOON WAS NEVER THE TOP. IT WAS THE FIRST STOP.", 74.4, 4.6);

    t.state("radio", 1, 79.6);
    t.hold("commander", MEET_SPOT, 80, 16, { pose: "phone", face: meetLook });

    say(SPEAKERS.radio, undefined, "HOW ARE YOU BOYS? DID YOU MAKE IT?", 80.4, 3.8);
    say(SPEAKERS.commander, "commander", "WE MADE IT. AND WE ARE GOING FURTHER.", 84.6, 3.6);
    say(SPEAKERS.radio, undefined, "FURTHER? FURTHER WHERE?", 88.6, 2.8);
    say(SPEAKERS.commander, "commander", "THAT IS WHAT WE ARE GOING TO FIND OUT.", 92, 3.4);
    say(SPEAKERS.radio, undefined, "...UNDERSTOOD. WE START BUILDING THE NEXT ONE TONIGHT.", 96, 4.6);
    t.state("radio", 0, 101);

    t.hold("commander", MEET_SPOT, 101, 6, { pose: "hail", face: teamLook });
    say(SPEAKERS.commander, "commander", "NO TIME TO REST. WE HAVE A LOT OF WORK AHEAD.", 101.4, 4.6);

    t.hold("commander", MEET_SPOT, 107, 35, { pose: "gawk", face: CREW_LOOK_UP });
    t.hold("walter", MEET_SPOT_B, 107, 35, { pose: "gawk", face: CREW_LOOK_UP });
    t.ramp("galaxy", 0, 1, 107, 7);

    say(SPEAKERS.walter, "walter", "...HOW FAR IS THAT?", 109.4, 2.6);
    say(SPEAKERS.commander, "commander", "FAR ENOUGH TO BE WORTH IT. GET TO WORK.", 113, 4.2);

    t.state("field.busy", 1, 117.4);
    t.hold("neighbour", NEIGHBOUR_SPOT, 104, 20, { pose: "hail", face: CREW_LOOK_UP });
    t.hold("neighbourMate", NEIGHBOUR_MATE, 104, 20, { pose: "work", face: meetLook });
    t.hold("teamA", TEAM_SPOT_A, 104, 20, { pose: "work", face: teamLook });
    t.hold("teamB", TEAM_SPOT_B, 104, 20, { pose: "work", face: teamLook });

    say(SPEAKERS.neighbour, "neighbour", "THREE. TWO. ONE.", 119, 3.4);
    t.ramp("neighbour.blast", 0, 1, 122.4, 1.2);
    t.ramp("neighbour.lift", 0, 1, 123.2, 16);
    shout("FURTHER!", 124, 2.6);

    t.ramp("galaxy", 1, 0.45, 128, 8);

    const reset = 142;
    t.state("mount.commander", 2, reset);
    t.state("mount.walter", 2, reset);
    t.state("hatch", 0, reset);
    t.state("arm", 1, reset);
    t.state("cage", 1, reset);
    t.state("rocket.lift", 1, reset);
    t.state("rocket.blast", 0.95, reset);
    t.state("dust", 0, reset);
    t.state("galaxy", 0, reset);
    t.state("field.busy", 0, reset);
    t.state("neighbour.blast", 0, reset);
    t.state("neighbour.lift", 0, reset);
    t.state("radio", 0, reset);

    t.hold("commander", commanderSeat, reset, 4, { pose: "sit", facing: Math.PI });
    t.hold("walter", walterSeat, reset, 4, { pose: "sit", facing: Math.PI });
    t.hold("neighbour", NEIGHBOUR_SPOT, reset, 4, { pose: "work", face: meetLook });
    t.hold("neighbourMate", NEIGHBOUR_MATE, reset, 4, { pose: "work", face: meetLook });
    t.hold("teamA", TEAM_SPOT_A, reset, 4, { pose: "gawk", face: crewLook });
    t.hold("teamB", TEAM_SPOT_B, reset, 4, { pose: "carry", face: crewLook });

    t.setCursor(reset + 5);
    t.beat(1);
}
