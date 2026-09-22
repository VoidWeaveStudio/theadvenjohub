// src/features/game/world/locations/showcase/rooms/launch/launchScript.ts
import * as THREE from "three";
import type { SceneTimeline } from "../../scene/SceneTimeline";
import {
    CONTROL_SPOT,
    CREW_IDLE_A,
    CREW_IDLE_B,
    ENGINEER_CLEAR,
    ENGINEER_SPOT,
    GUEST_A,
    GUEST_B,
    PAD_DECK_Y,
    armSpot,
    cabinDoorSpot,
    cageDoor,
    cageEntry,
    cageStand,
    cageStandWorld,
    hatchSpot,
    seatPoint,
    towerDeck,
    towerFoot,
} from "./launchLayout";

export const LIFTOFF_TIME = 88;
export const TRANSFER_DELAY = 15;

const SPEAKERS = {
    commander: "COMMANDER",
    walter: "WALTER",
    engineer: "ENGINEER",
    control: "GROUND CONTROL",
    crowd: "THE PAD",
};

const ROCKET_LOOK = new THREE.Vector3(0, PAD_DECK_Y + 14, 0);

export function buildLaunchScript(t: SceneTimeline): void {
    const say = (speaker: string, actor: string | undefined, text: string, start: number, duration: number) =>
        t.line(speaker, text, start, duration, actor);

    const shout = (text: string, start: number, duration: number) =>
        t.line(SPEAKERS.crowd, text, start, duration, undefined, true);

    const commanderSeat = seatPoint("commander");
    const walterSeat = seatPoint("walter");
    const cabinDoor = cabinDoorSpot();
    const foot = towerFoot();
    const door = cageDoor();
    const entry = cageEntry();
    const deck = towerDeck();
    const arm = armSpot();
    const hatch = hatchSpot();

    t.state("mount.commander", 0, 0);
    t.state("mount.walter", 0, 0);
    t.state("cage", 0, 0);
    t.state("arm", 0, 0);
    t.state("hatch", 1, 0);
    t.state("count", 0, 0);
    t.state("rocket.blast", 0, 0);
    t.state("rocket.lift", 0, 0);
    t.state("charts", 0, 0);
    t.state("pad.flood", 0.5, 0);
    t.state("transfer", 0, 0);

    t.hold("commander", CREW_IDLE_A, 0, 27, { face: ROCKET_LOOK });
    t.hold("walter", CREW_IDLE_B, 0, 9, { face: ROCKET_LOOK });
    t.hold("engineer", ENGINEER_SPOT, 0, 24, { pose: "work", facing: 1.1 });
    t.hold("control", CONTROL_SPOT, 0, 120, { pose: "phone", face: ROCKET_LOOK });
    t.hold("guestA", GUEST_A, 0, 84, { face: ROCKET_LOOK });
    t.hold("guestB", GUEST_B, 0, 84, { pose: "gawk", face: ROCKET_LOOK });

    say(SPEAKERS.walter, "walter", "WHAT IF IT DOESN'T FLY?", 4, 3.4);
    t.hold("walter", CREW_IDLE_B, 9, 18, { pose: "gawk", face: ROCKET_LOOK });

    say(SPEAKERS.commander, "commander", "HAVE FAITH, WALTER. WE HAVE BEEN BUILDING THIS THING FOR SO LONG.", 8, 5);
    say(SPEAKERS.engineer, "engineer", "IT WILL FLY. I ONLY SKIPPED THE PARTS NOBODY LOOKS AT.", 13.4, 4.6);
    say(SPEAKERS.walter, "walter", "THAT IS NOT THE COMFORT YOU THINK IT IS.", 18.4, 3.4);
    say(SPEAKERS.walter, "walter", "AND WHAT IS WAITING FOR US UP THERE?", 22.2, 3.2);
    say(SPEAKERS.commander, "commander", "WE FLY, WE FIND OUT.", 25.8, 2.6);
    say(SPEAKERS.control, "control", "CREW TO THE ELEVATOR. WE ARE GOING ON TIME.", 28.8, 4);

    t.move("commander", CREW_IDLE_A, foot, 27, 6);
    t.move("walter", CREW_IDLE_B, foot, 28.4, 6);
    t.move("commander", foot, door, 33.2, 2);
    t.move("walter", foot, door, 34.6, 2);

    t.hold("engineer", ENGINEER_SPOT, 24, 6, { pose: "salute", face: ROCKET_LOOK });
    t.move("engineer", ENGINEER_SPOT, ENGINEER_CLEAR, 30, 16);
    t.hold("engineer", ENGINEER_CLEAR, 46, 66, { pose: "gawk", face: ROCKET_LOOK });
    t.move("engineer", ENGINEER_CLEAR, ENGINEER_SPOT, 112, 11);

    t.state("mount.commander", 1, 35.4);
    t.state("mount.walter", 1, 36.8);
    t.move("commander", entry, cageStand("commander"), 35.4, 1.4, { linear: true });
    t.move("walter", entry, cageStand("walter"), 36.8, 1.4, { linear: true });
    t.hold("commander", cageStand("commander"), 36.8, 12, { facing: Math.PI / 2 });
    t.hold("walter", cageStand("walter"), 38.2, 10.6, { facing: Math.PI / 2 });

    t.ramp("cage", 0, 1, 39, 9.4);

    say(SPEAKERS.walter, "walter", "I CAN SEE THE WHOLE COAST FROM HERE.", 40.4, 3.4);
    say(SPEAKERS.commander, "commander", "TAKE A GOOD LOOK. IT GETS SMALLER FROM NOW ON.", 44.2, 4);

    t.state("mount.commander", 0, 48.8);
    t.state("mount.walter", 0, 50.4);
    t.move("commander", cageStandWorld("commander"), deck, 48.8, 2.4, { linear: true });
    t.move("walter", cageStandWorld("walter"), deck, 50.4, 2.4, { linear: true });
    t.move("commander", deck, arm, 51.2, 2.6);
    t.move("walter", deck, arm, 52.8, 2.6);
    t.move("commander", arm, hatch, 53.8, 3);
    t.move("walter", arm, hatch, 55.4, 3);

    t.state("mount.commander", 2, 56.8);
    t.state("mount.walter", 2, 58.4);
    t.move("commander", cabinDoor, commanderSeat, 56.8, 2.6, { linear: true });
    t.move("walter", cabinDoor, walterSeat, 58.4, 2.6, { linear: true });
    t.hold("commander", commanderSeat, 59.4, 62, { pose: "sit", facing: Math.PI });
    t.hold("walter", walterSeat, 61, 60.4, { pose: "sit", facing: Math.PI });

    say(SPEAKERS.control, "control", "HATCH CLOSED. ARM RETRACTING.", 62.4, 3.4);
    t.ramp("hatch", 1, 0, 62.4, 1.6);
    t.ramp("arm", 0, 1, 65, 6);
    t.ramp("pad.flood", 0.5, 1, 66, 4);

    say(SPEAKERS.walter, "walter", "MY HANDS ARE SHAKING.", 67, 2.6);
    say(SPEAKERS.commander, "commander", "THEN HOLD ON TO SOMETHING. THAT IS THE WHOLE JOB.", 70.2, 4.4);

    const countStart = LIFTOFF_TIME - 11.2;
    const words = ["TEN", "NINE", "EIGHT", "SEVEN", "SIX", "FIVE", "FOUR", "THREE", "TWO", "ONE"];
    for (let i = 0; i < words.length; i++) {
        const at = countStart + i * 1.06;
        say(SPEAKERS.control, "control", `${words[i]}.`, at, 0.94);
        t.state("count", 10 - i, at);
    }

    t.state("count", 11, LIFTOFF_TIME - 0.1);
    t.state("count", 0, LIFTOFF_TIME + 6);
    shout("LAUNCH!", LIFTOFF_TIME, 2.6);

    t.ramp("rocket.blast", 0, 1, LIFTOFF_TIME - 0.6, 1.4);
    t.ramp("rocket.lift", 0, 1, LIFTOFF_TIME + 0.4, 34);
    t.state("charts", 1, LIFTOFF_TIME + 1.4);

    say(SPEAKERS.walter, "walter", "WE ARE DOWN FORTY PERCENT.", LIFTOFF_TIME + 3.4, 3);
    say(SPEAKERS.commander, "commander", "WE ARE ALSO UP FOUR HUNDRED METRES PER SECOND.", LIFTOFF_TIME + 6.8, 4.2);
    t.state("charts", 2, LIFTOFF_TIME + 11.4);
    say(SPEAKERS.walter, "walter", "...THAT IS THE FIRST GREEN CANDLE I HAVE SEEN ALL YEAR.", LIFTOFF_TIME + 11.4, 4.4);

    t.state("transfer", 1, LIFTOFF_TIME + TRANSFER_DELAY);

    t.hold("guestA", GUEST_A, 84, 26, { pose: "cheer", face: ROCKET_LOOK });
    t.hold("guestB", GUEST_B, 84, 26, { pose: "hail", face: ROCKET_LOOK });

    t.ramp("rocket.blast", 1, 0.62, LIFTOFF_TIME + 8, 18);
    t.ramp("pad.flood", 1, 0.5, LIFTOFF_TIME + 14, 8);

    const reset = LIFTOFF_TIME + 36;
    t.state("rocket.lift", 0, reset);
    t.state("rocket.blast", 0, reset);
    t.state("charts", 0, reset);
    t.state("hatch", 1, reset);
    t.state("arm", 0, reset);
    t.state("cage", 0, reset);
    t.state("count", 0, reset);
    t.state("transfer", 0, reset);
    t.state("mount.commander", 0, reset);
    t.state("mount.walter", 0, reset);

    t.hold("commander", CREW_IDLE_A, reset, 4, { face: ROCKET_LOOK });
    t.hold("walter", CREW_IDLE_B, reset, 4, { face: ROCKET_LOOK });
    t.hold("engineer", ENGINEER_SPOT, reset, 4, { pose: "work", facing: 1.1 });
    t.hold("guestA", GUEST_A, reset, 4, { face: ROCKET_LOOK });
    t.hold("guestB", GUEST_B, reset, 4, { pose: "gawk", face: ROCKET_LOOK });

    t.setCursor(reset + 5);
    t.beat(1);
}
