// scripts/gen-voice-lines.mjs
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const SCRIPT_FILE = path.join(ROOT, "src/features/game/world/locations/showcase/rooms/church/churchScript.ts");
const OUT_DIR = path.join(ROOT, "public/audio/voice/church");
const ENV_FALLBACK = path.join(ROOT, "..", "game-server", ".env");

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

// One voice per role. Two holders and two churchgoers share a label in the script but
// are different actors, so they are pitched apart instead of sounding like one person.
const VOICES = {
    father: { name: "en-US-Neural2-D", pitch: -2.5, rate: 0.92 },
    sinner: { name: "en-US-Neural2-A", pitch: 0, rate: 1 },
    preacher: { name: "en-US-Neural2-J", pitch: -1, rate: 0.96 },
    holderA: { name: "en-US-Neural2-I", pitch: 1, rate: 1.04 },
    holderB: { name: "en-US-Neural2-I", pitch: -3, rate: 0.98 },
    widowA: { name: "en-US-Neural2-F", pitch: 2, rate: 1.06 },
    widowB: { name: "en-US-Neural2-C", pitch: -1, rate: 1 },
    CONGREGATION: { name: "en-US-Neural2-J", pitch: -4, rate: 1.05 },
};

const SAY = /say\(\s*SPEAKERS\.(\w+)\s*,\s*"([^"]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*([^,]+?)\s*,\s*([\d.]+)\s*\)/g;
const SHOUT = /shout\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*([^,]+?)\s*,\s*([\d.]+)\s*\)/g;
const SPEAKER_MAP = /const SPEAKERS = \{([\s\S]*?)\};/;

// The captions are written in comic-book caps and the asterisks are stage directions.
// Read literally, both come out wrong, so the spoken copy is normalised while the
// on-screen text keeps exactly what the author wrote.
function spoken(text) {
    const cleaned = text.replace(/\*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// The captured text has to come out byte-identical to the string the client sees, since
// the manifest is looked up by the line's own text at runtime.
function unescape(text) {
    return text.replace(/\\(["\\])/g, "$1");
}

function readLines() {
    const src = fs.readFileSync(SCRIPT_FILE, "utf8");

    const speakers = {};
    const block = src.match(SPEAKER_MAP);
    if (block) {
        for (const entry of block[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)) speakers[entry[1]] = entry[2];
    }

    const lines = [];

    for (const match of src.matchAll(SAY)) {
        lines.push({
            speaker: speakers[match[1]] ?? match[1].toUpperCase(),
            actor: match[2],
            text: unescape(match[3]),
            duration: Number(match[5]),
        });
    }

    for (const match of src.matchAll(SHOUT)) {
        lines.push({
            speaker: speakers.crowd ?? "CONGREGATION",
            actor: undefined,
            text: unescape(match[1]),
            duration: Number(match[3]),
        });
    }

    // A repeated crowd shout is one clip, not several.
    const seen = new Set();
    return lines.filter((line) => {
        const key = `${line.actor ?? line.speaker}|${line.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function apiKey() {
    if (process.env.GOOGLE_TTS_API_KEY) return process.env.GOOGLE_TTS_API_KEY;

    if (fs.existsSync(ENV_FALLBACK)) {
        const match = fs.readFileSync(ENV_FALLBACK, "utf8").match(/^GOOGLE_TTS_API_KEY=(.+)$/m);
        if (match && match[1].trim()) return match[1].trim();
    }

    return null;
}

async function synthesize(key, text, voice) {
    const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            input: { text },
            voice: { languageCode: voice.name.split("-").slice(0, 2).join("-"), name: voice.name },
            audioConfig: { audioEncoding: "MP3", pitch: voice.pitch, speakingRate: voice.rate },
        }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    if (typeof data.audioContent !== "string") throw new Error("no audioContent in response");
    return Buffer.from(data.audioContent, "base64");
}

const force = process.argv.includes("--force");
const lines = readLines();

console.log(`church voice — ${lines.length} lines`);

const key = apiKey();
if (!key) {
    console.error("\nGOOGLE_TTS_API_KEY not set (checked env and game-server/.env)");
    process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = [];
const tight = [];
let made = 0;
let cached = 0;
let failed = 0;

for (const line of lines) {
    const voice = VOICES[line.actor ?? line.speaker] ?? VOICES.sinner;
    const id = crypto.createHash("sha1").update(`${line.actor ?? line.speaker}|${line.text}`).digest("hex").slice(0, 12);
    const file = `${id}.mp3`;
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

    try {
        fs.writeFileSync(target, await synthesize(key, spoken(line.text), voice));
        made++;
        console.log(`  + ${line.speaker.padEnd(13)} ${file}  ${line.text.slice(0, 48)}`);
    } catch (error) {
        failed++;
        console.error(`  ! ${line.speaker.padEnd(13)} ${line.text.slice(0, 48)} — ${error.message}`);
    }
}

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const known = new Set(manifest.map((entry) => entry.file));
const orphans = fs.readdirSync(OUT_DIR).filter((name) => name.endsWith(".mp3") && !known.has(name));

console.log(`\n${made} generated, ${cached} cached, ${failed} failed`);
if (orphans.length > 0) console.log(`${orphans.length} orphan clip(s) no longer in the script: ${orphans.join(", ")}`);

if (tight.length > 0) {
    console.log(`\n${tight.length} line(s) look too long for their beat — widen the duration in churchScript.ts:`);
    for (const line of tight) {
        console.log(`  ${line.duration}s for ${Math.ceil(line.text.length / 15)}s of speech: ${line.text.slice(0, 60)}`);
    }
}

process.exit(failed > 0 ? 1 : 0);
