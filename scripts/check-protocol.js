// scripts/check-protocol.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(scriptDir, "..", "..", "game-server");
const serverPath = path.join(serverDir, "server.js");
const clientPath = path.join(scriptDir, "..", "src", "features", "game", "network", "NetworkManager.ts");

const NOT_MESSAGES = new Set([
    "visit_npcs",
    "kill_enemies",
    "husk",
    "voidling",
    "slime_warden",
    "system",
]);

const KNOWN_GAPS = {
    serverToClient: [],
    clientToServer: ["auth", "pong"],
    clientOrphans: ["pong"],
};

let failures = 0;

function check(label, offenders, known) {
    const unexpected = offenders.filter((type) => !known.includes(type));
    const suffix = known.length > 0 ? ` (известных дыр: ${known.length})` : "";

    if (unexpected.length === 0) {
        console.log(`  ok   ${label}${suffix}`);
        return;
    }

    failures++;
    console.log(`  FAIL ${label} — ${unexpected.join(", ")}`);
}

function switchBody(source, header) {
    const start = source.indexOf(header);
    if (start === -1) throw new Error(`[protocol] не найден ${header}`);

    let depth = 0;
    for (let i = start; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`[protocol] не закрыт ${header}`);
}

function collect(text, pattern) {
    return new Set([...text.matchAll(pattern)].map((m) => m[1]).filter((type) => !NOT_MESSAGES.has(type)));
}

function missing(from, into) {
    return [...from].filter((type) => !into.has(type)).sort();
}

function serverSource() {
    const entry = fs.readFileSync(serverPath, "utf8");
    const parts = [entry];
    const seen = new Set();

    for (const match of entry.matchAll(/require\(['"]\.\/([\w-]+)['"]\)/g)) {
        const name = match[1];
        if (seen.has(name)) continue;
        seen.add(name);

        const file = path.join(serverDir, `${name}.js`);
        if (fs.existsSync(file)) parts.push(fs.readFileSync(file, "utf8"));
    }

    return parts.join("\n");
}

function run() {
    const server = serverSource();
    const client = fs.readFileSync(clientPath, "utf8");

    const casePattern = /case\s*['"]([a-zA-Z][\w]*)['"]\s*:/g;
    const sendPattern = /type:\s*['"]([a-zA-Z][\w]*)['"]/g;

    const serverSends = collect(server, sendPattern);
    const serverHandles = collect(switchBody(server, "switch (data.type)"), casePattern);
    const clientSends = collect(client, sendPattern);
    const clientHandles = collect(switchBody(client, "switch (data.type)"), casePattern);

    console.log("websocket protocol");
    console.log(`       server sends ${serverSends.size}, handles ${serverHandles.size}`);
    console.log(`       client sends ${clientSends.size}, handles ${clientHandles.size}`);

    check("every message the server sends is handled by the client",
        missing(serverSends, clientHandles), KNOWN_GAPS.serverToClient);

    check("every message the client sends is handled by the server",
        missing(clientSends, serverHandles), KNOWN_GAPS.clientToServer);

    check("no client handler waits for a message nobody sends",
        missing(clientHandles, serverSends), KNOWN_GAPS.clientOrphans);

    console.log(failures === 0 ? "\nprotocol checks passed" : `\n${failures} protocol check(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
}

run();
