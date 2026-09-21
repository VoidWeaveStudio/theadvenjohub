// src/features/game/world/locations/showcase/rooms/church/churchScript.ts
import * as THREE from "three";
import type { SceneTimeline } from "../../scene/SceneTimeline";
import {
    ALTAR_Z,
    boothCellPoint,
    boothDoorPoint,
    boothGrillePoint,
    NAVE_START,
    PULPIT_DECK_Y,
    PULPIT_FACING,
    PULPIT_X,
    PULPIT_Z,
    pewApproachPoint,
    pewSeatPoint,
    STORY_SEATS,
} from "./churchLayout";

export interface ChurchSpots {
    gateSpot: THREE.Vector3;
    aisleSpot: THREE.Vector3;
    penitentDoor: THREE.Vector3;
    penitentSeat: THREE.Vector3;
    priestDoor: THREE.Vector3;
    priestSeat: THREE.Vector3;
    grille: THREE.Vector3;
    deck: THREE.Vector3;
    blessSpot: THREE.Vector3;
    behindPulpit: THREE.Vector3;
    stageFoot: THREE.Vector3;
    stageTop: THREE.Vector3;
    naveLook: THREE.Vector3;
}

// Every place the service uses, derived from the room's layout rather than written out
// twice: the casting pass and the cue list both read these.
export function churchSpots(): ChurchSpots {
    const deck = new THREE.Vector3(PULPIT_X, PULPIT_DECK_Y, PULPIT_Z);

    // The pulpit's open side looks back down the nave, so the step-down spot and the
    // blessing spot are taken off that same heading instead of being guessed at.
    const front = new THREE.Vector3(Math.sin(PULPIT_FACING), 0, Math.cos(PULPIT_FACING));

    return {
        gateSpot: new THREE.Vector3(0, 0, NAVE_START + 10),
        aisleSpot: new THREE.Vector3(0, 0, 7),
        penitentDoor: boothDoorPoint("penitent"),
        penitentSeat: boothCellPoint("penitent"),
        priestDoor: boothDoorPoint("priest"),
        priestSeat: boothCellPoint("priest"),
        grille: boothGrillePoint(),
        deck,
        blessSpot: deck.clone().setY(0).addScaledVector(front, 2.7),
        behindPulpit: deck.clone().setY(0).addScaledVector(front, -2.6),
        stageFoot: new THREE.Vector3(0, 0, ALTAR_Z - 5.4),
        stageTop: new THREE.Vector3(0, 1.26, ALTAR_Z - 2.6),
        naveLook: new THREE.Vector3(0, 1.6, PULPIT_Z - 10),
    };
}

const SPEAKERS = {
    father: "FATHER",
    sinner: "PENITENT",
    preacher: "PREACHER",
    holder: "HOLDER",
    widow: "CHURCHGOER",
    crowd: "CONGREGATION",
};

export function buildChurchScript(t: SceneTimeline, spot: ChurchSpots): void {
    const say = (speaker: string, actor: string | undefined, text: string, start: number, duration: number) =>
        t.line(speaker, text, start, duration, actor);

    // Congregation lines move every mouth in the room.
    const shout = (text: string, start: number, duration: number) =>
        t.line(SPEAKERS.crowd, text, start, duration, undefined, true);

    const sinnerSeat = pewSeatPoint(STORY_SEATS.sinner);
    const sinnerApproach = pewApproachPoint(STORY_SEATS.sinner);
    const fatherSeat = pewSeatPoint(STORY_SEATS.father);
    const fatherApproach = pewApproachPoint(STORY_SEATS.father);

    // 1. Up the nave, past the gossip in the back rows.
    t.hold("sinner", spot.gateSpot, 0, 2, { facing: 0 });
    t.move("sinner", spot.gateSpot, spot.aisleSpot, 2, 20);

    say(SPEAKERS.holder, "holderA", "SO HOW LONG HAVE YOU BEEN HOLDING?", 4.5, 3);
    say(SPEAKERS.holder, "holderB", "TWO YEARS NOW.", 8, 2.6);
    say(SPEAKERS.holder, "holderA", "TWO YEARS? BROTHER, YOU ARE BUILT DIFFERENT.", 11, 3.4);
    say(SPEAKERS.widow, "widowA", "HEARD JUANITA'S HUSBAND SOLD THE LOT THE SECOND IT DIPPED. ONE PERCENT!", 15, 4.6);
    say(SPEAKERS.widow, "widowB", "NO WONDER. HIS RECORD IS ONE MONTH. MINE HAS HELD FOR FOUR YEARS.", 20, 4.6);
    say(SPEAKERS.widow, "widowA", "ANY EXCUSE TO BRAG.", 25, 2.4);

    t.move("sinner", spot.aisleSpot, spot.penitentDoor, 22, 4.5);
    t.state("door.penitent", 1, 24.4);
    t.move("sinner", spot.penitentDoor, spot.penitentSeat, 26.5, 2.5);
    t.hold("sinner", spot.penitentSeat, 29, 78, { pose: "sit", face: spot.grille, held: false });
    t.state("door.penitent", 0, 30.2);

    // 2. The confession itself.
    say(SPEAKERS.father, "father", "HELLO, MY SON. WHAT BRINGS YOU TO ME?", 31, 4);
    say(SPEAKERS.sinner, "sinner", "I DID SOMETHING STUPID, FATHER.", 35.5, 3.2);
    say(SPEAKERS.father, "father", "WHAT DID YOU DO?", 39.2, 2.4);
    say(SPEAKERS.sinner, "sinner", "I GATHERED GOOD PEOPLE AROUND ME. THEY LISTENED TO WHAT I HAD TO SAY.", 42.2, 5.4);
    say(SPEAKERS.father, "father", "GUIDING OTHERS ONTO THE TRUE PATH IS A GOOD THING, MY SON. SO WHERE IS THE SIN?", 48.2, 5.8);
    say(SPEAKERS.sinner, "sinner", "THE POWER SPOILED ME. I THOUGHT I COULD FOOL THEM ALL.", 54.5, 4.4);
    say(SPEAKERS.sinner, "sinner", "I LAUNCHED MY OWN COIN, MEANING TO DUMP IT THE MOMENT THE PRICE FLEW.", 59.4, 5.4);
    say(SPEAKERS.father, "father", "THAT IS A GRAVE SIN, MY SON. A RUG PULL IS A SERIOUS OFFENCE.", 65.4, 5);
    say(SPEAKERS.sinner, "sinner", "THEN THEY RAN THE WALLETS. EVERY ONE OF THEM TRACED BACK TO ME.", 71, 5);
    say(SPEAKERS.sinner, "sinner", "EVERYONE TURNED AWAY FROM ME.", 76.4, 3);
    say(SPEAKERS.father, "father", "IT WAS ALWAYS GOING TO COME OUT. SOONER OR LATER THEY ALL LEARN YOU ARE A PIECE OF...", 80, 5.4);
    say(SPEAKERS.father, "father", "*KHM-KHM* ...THAT YOU DID A WICKED THING.", 85.6, 3.4);
    say(SPEAKERS.sinner, "sinner", "WHAT DO I DO NOW, FATHER?", 89.4, 2.8);
    say(SPEAKERS.father, "father", "MAKE A POST ABOUT IT AND REPENT. THEY WILL NOT ACCEPT YOUR APOLOGY.", 92.6, 5);
    say(SPEAKERS.father, "father", "BUT YOU MUST PROVE BY DEEDS THAT YOU ARE NOT A PIECE OF... *KHM-KHM* ...NOT A BAD MAN.", 98, 5.6);
    say(SPEAKERS.father, "father", "SHILL OTHER PROJECTS. HOLD, AND NEVER SELL. BELIEVE, MY SON, AND ONE DAY YOU WILL UNDERSTAND.", 104, 6);
    say(SPEAKERS.sinner, "sinner", "UNDERSTAND WHAT?", 110.4, 2.2);
    say(SPEAKERS.father, "father", "THE TIME WILL COME AND YOU WILL HAVE YOUR ANSWER. NOW GO. IT STARTS SOON.", 113, 5.4);

    t.hold("sinner", spot.penitentSeat, 107, 13, { pose: "sit", face: spot.grille, held: false });
    t.hold("father", spot.priestSeat, 0, 120, { pose: "sit", face: spot.grille });

    // 3. Meanwhile, bags are blessed at the pulpit. No captions here — the confession
    // owns the caption strip, and the mime reads clearly enough on its own.
    const queue: Array<{ id: string; start: number }> = [
        { id: "suppliantA", start: 34 },
        { id: "suppliantB", start: 62 },
        { id: "suppliantC", start: 88 },
    ];

    for (const entry of queue) {
        const seat = pewSeatPoint(STORY_SEATS[entry.id]);
        const approach = pewApproachPoint(STORY_SEATS[entry.id]);
        const start = entry.start;

        t.move(entry.id, seat, approach, start, 1.6);
        t.move(entry.id, approach, spot.blessSpot, start + 1.8, 6);
        t.hold(entry.id, spot.blessSpot, start + 7.8, 2, { face: spot.deck, pose: "hail" });
        t.hold(entry.id, spot.blessSpot, start + 9.8, 3.4, { face: spot.deck, pose: "kneel" });
        t.hold(entry.id, spot.blessSpot, start + 13.2, 1.4, { face: spot.deck, pose: "pray" });
        t.move(entry.id, spot.blessSpot, approach, start + 14.6, 6);
        t.move(entry.id, approach, seat, start + 20.6, 1.6);
        t.hold(entry.id, seat, start + 22.2, 4, { pose: "sit", facing: 0.04 });

        t.hold("preacher", spot.deck, start + 7.6, 2.2, { pose: "preach", facing: PULPIT_FACING });
        t.hold("preacher", spot.deck, start + 9.8, 3.6, { pose: "bless", facing: PULPIT_FACING });
        t.hold("preacher", spot.deck, start + 13.4, 2, { pose: "preach", facing: PULPIT_FACING });
    }

    // 4. He leaves the booth; the preacher comes down and crosses to the platform;
    // the father follows him out and takes a bench.
    t.state("door.penitent", 1, 118.6);
    t.move("sinner", spot.penitentSeat, spot.penitentDoor, 120, 2.4);
    t.state("door.penitent", 0, 123.4);
    t.move("sinner", spot.penitentDoor, sinnerApproach, 123, 4.2);
    t.move("sinner", sinnerApproach, sinnerSeat, 127.4, 1.6);
    t.hold("sinner", sinnerSeat, 129, 2, { pose: "sit", facing: 0.02, held: false });

    t.hold("preacher", spot.deck, 118, 3, { pose: "preach", facing: PULPIT_FACING });
    t.move("preacher", spot.deck, spot.behindPulpit, 121, 2.6);
    t.move("preacher", spot.behindPulpit, spot.stageFoot, 124, 5.4);
    t.move("preacher", spot.stageFoot, spot.stageTop, 129.6, 2.6);
    t.hold("preacher", spot.stageTop, 132.4, 4, { face: spot.naveLook, held: false });

    t.state("door.priest", 1, 120.6);
    t.move("father", spot.priestSeat, spot.priestDoor, 122, 2.4);
    t.state("door.priest", 0, 125.6);
    t.move("father", spot.priestDoor, fatherApproach, 125, 4.4);
    t.move("father", fatherApproach, fatherSeat, 129.6, 1.6);
    t.hold("father", fatherSeat, 131.2, 2, { pose: "sit", facing: 0.02 });

    // 5. Silence, then the sermon.
    const sermon = 138;
    t.hold("preacher", spot.stageTop, 136.4, 2, { pose: "preach", face: spot.naveLook, held: false });

    say(SPEAKERS.preacher, "preacher", "I GREET YOU, BROTHERS AND SISTERS.", sermon, 3.6);
    say(
        SPEAKERS.preacher,
        "preacher",
        "TODAY, ON THIS BLESSED DAY, WE ARE GATHERED TO GLORIFY OUR GREAT HOLDER, BEARER OF THE DIAMOND HANDS.",
        sermon + 4,
        6.4
    );
    say(SPEAKERS.preacher, "preacher", "AND TO REMEMBER HIS TEACHING. TO HOLD.", sermon + 10.8, 4);
    say(SPEAKERS.preacher, "preacher", "EVEN IN THE WORST SITUATION... HOLD.", sermon + 15.2, 4);
    say(SPEAKERS.preacher, "preacher", "EVEN IF THE MARKET DECIDES TO FALL... HOLD.", sermon + 19.6, 4);
    say(SPEAKERS.preacher, "preacher", "EVEN IF YOU THINK THE DEV WALKED OUT AND LEFT THE PROJECT...", sermon + 24, 4.4);

    t.hold("preacher", spot.stageTop, sermon + 24, 4.4, { pose: "point", face: spot.naveLook, held: false });
    shout("HOLD!", sermon + 28.6, 2.2);
    t.hold("preacher", spot.stageTop, sermon + 28.4, 3, { pose: "preach", face: spot.naveLook, held: false });

    say(SPEAKERS.preacher, "preacher", "EVEN IF THE KOL EXITS THE PROJECT...", sermon + 31.4, 3.6);
    t.hold("preacher", spot.stageTop, sermon + 31.4, 3.6, { pose: "hail", face: spot.naveLook, held: false });

    t.state("congregation.stand", 1, sermon + 35);
    shout("HOLD!", sermon + 35.2, 2.6);

    t.hold("preacher", spot.stageTop, sermon + 38, 6, { pose: "preach", face: spot.naveLook, held: false });
    say(SPEAKERS.preacher, "preacher", "FOR ONLY TRUE HOLDERS GIVE HOPE TO THE REST OF US.", sermon + 38.4, 4.6);
    say(SPEAKERS.preacher, "preacher", "AND TOGETHER, YOU AND I, WE CAN SEND ANYONE...", sermon + 43.4, 4.2);

    t.hold("preacher", spot.stageTop, sermon + 44, 4, { pose: "hail", face: spot.naveLook, held: false });
    shout("TO THE MOON!", sermon + 48, 3);

    say(SPEAKERS.preacher, "preacher", "NOW TAKE OUT YOUR BAGS, AND MAY THE GREAT ONE BLESS THEM.", sermon + 51.4, 5);
    t.hold("preacher", spot.stageTop, sermon + 51.4, 5, { pose: "bless", face: spot.naveLook, held: false });

    // 6. Bags up, and the window answers.
    const lift = sermon + 56.6;
    t.state("bags.up", 1, lift);
    t.hold("preacher", spot.stageTop, lift, 14, { pose: "hail", face: spot.naveLook, held: false });
    t.ramp("rose", 0, 1, lift + 0.6, 5.4);
    t.ramp("rose", 1, 1, lift + 6, 7);

    t.hold("sinner", sinnerSeat, lift, 14, { pose: "cheer", facing: 0.02, held: true });
    t.hold("father", fatherSeat, lift, 14, { pose: "pray", facing: 0.02 });

    t.ramp("rose", 1, 0, lift + 13, 4);
    t.state("bags.up", 0, lift + 14.4);
    t.state("congregation.stand", 0, lift + 15);

    t.hold("sinner", sinnerSeat, lift + 14.6, 2, { pose: "sit", facing: 0.02, held: false });
    t.hold("father", fatherSeat, lift + 14.6, 2, { pose: "sit", facing: 0.02 });
    t.hold("preacher", spot.stageTop, lift + 15.2, 2, { pose: "preach", face: spot.naveLook, held: false });

    // Back to the start: everyone resettles and the loop runs again.
    t.setCursor(lift + 22);
    t.beat(2);
}
