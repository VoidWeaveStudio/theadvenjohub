// scripts/gen-zh-tw.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as OpenCC from "opencc-js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(here, "..", "src", "core", "i18n", "locales");
const SOURCE = path.join(LOCALES, "zh.ts");
const TARGET = path.join(LOCALES, "zh-tw.ts");

const ENTRY_LINE = /^(\s*"(?:[^"\\]|\\.)*":\s*")((?:[^"\\]|\\.)*)("(?:,)?\s*)$/;

const convert = OpenCC.Converter({ from: "cn", to: "twp" });

const OVERRIDES = [
    [/臺/g, "台"],
];

function localise(text) {
    let out = convert(text);
    for (const [pattern, replacement] of OVERRIDES) out = out.replace(pattern, replacement);
    return out;
}

function generate() {
    const source = fs.readFileSync(SOURCE, "utf8");
    const out = [];

    for (const line of source.split("\n")) {
        const match = line.match(ENTRY_LINE);
        if (!match) {
            out.push(line);
            continue;
        }
        out.push(`${match[1]}${localise(match[2])}${match[3]}`);
    }

    return out
        .join("\n")
        .replace("// src/core/i18n/locales/zh.ts", "// src/core/i18n/locales/zh-tw.ts")
        .replace("export const zh: Translations", "export const zhTw: Translations")
        .replace("export default zh;", "export default zhTw;");
}

const generated = generate();

if (process.argv.includes("--check")) {
    const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
    if (current !== generated) {
        console.error("zh-tw.ts is out of date — run `npm run sync:zh-tw`");
        process.exit(1);
    }
    console.log("zh-tw.ts matches zh.ts");
} else {
    fs.writeFileSync(TARGET, generated, "utf8");
    const keys = (generated.match(/^\s*"([^"\\]|\\.)*":\s/gm) || []).length;
    console.log(`wrote ${path.relative(process.cwd(), TARGET)} — ${keys} keys`);
}
