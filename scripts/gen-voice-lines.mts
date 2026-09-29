// scripts/gen-voice-lines.mts
// Generates the church's voice clips from the scene script itself, so the text spoken is
// byte-identical to the text the client looks a clip up by. Runs a local model — no
// account, no key, no quota. Run with: npm run gen:voice
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { KokoroTTS } from "kokoro-js";
import { buildChurchScript, churchSpots } from "../src/features/game/world/locations/showcase/rooms/church/churchScript";
import { SceneTimeline, type SceneLine } from "../src/features/game/world/locations/showcase/scene/SceneTimeline";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "..", "public/audio/voice/church");

const MODEL = "onnx-community/Kokoro-82M-ONNX";
const DTYPE = "q8";

// One voice per role. Two holders and two churchgoers share a speaker label in the
// script but are different actors, so they get different voices rather than sounding
// like one person. Anything the model does not list falls back and is reported.
const VOICES: Record<string, string> = {
    father: "am_onyx",
    sinner: "am_adam",
    preacher: "am_fenrir",
    holderA: "am_michael",
    holderB: "am_puck",
    widowA: "af_bella",
    widowB: "af_nicole",
    CONGREGATION: "am_eric",
};

const FALLBACK = "am_adam";

// The captions are written in comic-book caps and the asterisks are stage directions.
// Read literally both come out wrong, so the spoken copy is normalised while the
// on-screen text keeps exactly what the author wrote.
function spoken(text: string): string {
    const cleaned = text.replace(/\*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function roleOf(line: SceneLine): string {
    return line.actor ?? line.speaker;
}

function clipId(line: SceneLine): string {
    return crypto.createHash("sha1").update(`${roleOf(line)}|${line.text}`).digest("hex").slice(0, 12);
}

function readLines(): SceneLine[] {
    const timeline = new SceneTimeline();
    buildChurchScript(timeline, churchSpots());

    const seen = new Set<string>();

    // A repeated crowd shout is one clip, not several.
    return timeline.lines().filter((line) => {
        const key = `${roleOf(line)}|${line.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const force = process.argv.includes("--force");
const lines = readLines();

console.log(`church voice — ${lines.length} lines`);

fs.mkdirSync(OUT_DIR, { recursive: true });

const pending = lines.filter((line) => force || !fs.existsSync(path.join(OUT_DIR, `${clipId(line)}.wav`)));

let tts: Awaited<ReturnType<typeof KokoroTTS.from_pretrained>> | null = null;
let available: Set<string> | null = null;

if (pending.length > 0) {
    console.log(`loading ${MODEL} (${DTYPE}) — the first run downloads the model\n`);
    tts = await KokoroTTS.from_pretrained(MODEL, { dtype: DTYPE, device: "cpu" });

    const listed = tts.list_voices() as unknown;
    available = new Set(Array.isArray(listed) ? listed as string[] : Object.keys((listed ?? {}) as object));
}

const manifest: Array<{ speaker: string; actor?: string; text: string; file: string }> = [];
const tight: SceneLine[] = [];
const unknown = new Set<string>();
let made = 0;
let cached = 0;
let failed = 0;

for (const line of lines) {
    const file = `${clipId(line)}.wav`;
    const target = path.join(OUT_DIR, file);

    manifest.push({ speaker: line.speaker, actor: line.actor, text: line.text, file });

    // Roughly what natural English delivery fits in a second. A line well over its
    // authored beat gets cut off by the next one, so it is worth flagging here rather
    // than discovering it in the room.
    if (line.text.length / 15 > line.duration + 0.4) tight.push(line);

    if (!force && fs.existsSync(target)) {
        cached++;
        continue;
    }

    let voice = VOICES[roleOf(line)] ?? FALLBACK;
    if (available && !available.has(voice)) {
        unknown.add(voice);
        voice = available.has(FALLBACK) ? FALLBACK : [...available][0];
    }

    try {
        const audio = await tts!.generate(spoken(line.text), { voice });
        await audio.save(target);
        made++;
        console.log(`  + ${line.speaker.padEnd(13)} ${voice.padEnd(12)} ${file}  ${line.text.slice(0, 38)}`);
    } catch (error) {
        failed++;
        console.error(`  ! ${line.speaker.padEnd(13)} ${line.text.slice(0, 38)} — ${(error as Error).message}`);
    }
}

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const known = new Set(manifest.map((entry) => entry.file));
const orphans = fs.readdirSync(OUT_DIR).filter((name) => name.endsWith(".wav") && !known.has(name));

console.log(`\n${made} generated, ${cached} cached, ${failed} failed`);
if (orphans.length > 0) console.log(`${orphans.length} orphan clip(s) no longer in the script: ${orphans.join(", ")}`);

if (unknown.size > 0 && available) {
    console.log(`\nunknown voice id(s): ${[...unknown].join(", ")}`);
    console.log(`available: ${[...available].join(", ")}`);
}

if (tight.length > 0) {
    console.log(`\n${tight.length} line(s) look too long for their beat — widen the duration in churchScript.ts:`);
    for (const line of tight) {
        console.log(`  ${line.duration}s for ${Math.ceil(line.text.length / 15)}s of speech: ${line.text.slice(0, 58)}`);
    }
}

process.exit(failed > 0 ? 1 : 0);
