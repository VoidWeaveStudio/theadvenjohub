// app/api/image-proxy/route.ts
import { NextResponse } from "next/server";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import dns, { type LookupAllOptions, type LookupOneOptions } from "node:dns";
import { isIP } from "node:net";
import zlib from "node:zlib";

function isPrivateIp(ip: string): boolean {
    const version = isIP(ip);

    if (version === 4) {
        const parts = ip.split(".").map(Number);
        const [a, b] = parts;
        if (a === 127 || a === 10 || a === 0) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        return false;
    }

    if (version === 6) {
        const normalized = ip.toLowerCase();
        if (normalized === "::1") return true;
        if (normalized.startsWith("fe80:")) return true;
        if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
        if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
        return false;
    }

    return true;
}

type LookupCallback = (
    err: NodeJS.ErrnoException | null,
    addressOrAddresses?: string | dns.LookupAddress[],
    family?: number
) => void;

// Node's net/http internals call this with `options.all: true` when Happy
// Eyeballs (dual-stack `autoSelectFamily`, default since Node 18.13/20) is
// racing connections — in that mode they expect the array-form callback
// `(err, addresses[])`, not the single-result `(err, address, family)` form.
// Always replying in the single-result shape made Node read `.address`/
// `.family` off a bare string, producing `ERR_INVALID_IP_ADDRESS: undefined`
// and turning every image-proxy request into a 500.
function pinnedPublicLookup(
    hostname: string,
    options: LookupOneOptions | LookupAllOptions,
    callback: LookupCallback
) {
    const wantsAll = typeof options === "object" && options !== null && "all" in options && options.all === true;

    dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) {
            callback(err);
            return;
        }
        if (addresses.length === 0 || addresses.some((addr) => isPrivateIp(addr.address))) {
            callback(new Error("host_not_allowed"));
            return;
        }

        if (wantsAll) {
            callback(null, addresses);
            return;
        }

        const chosen = addresses[0];
        callback(null, chosen.address, chosen.family);
    });
}

function fetchViaPinnedLookup(url: URL): Promise<IncomingMessage> {
    const lib = url.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
        const req = lib.get(
            url,
            {
                lookup: pinnedPublicLookup as unknown as typeof dns.lookup,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "Accept-Encoding": "gzip, deflate, br"
                },
            },
            (res) => resolve(res)
        );
        req.on("error", reject);
    });
}

// Node's raw http/https client never auto-decompresses (unlike fetch/undici),
// so a gzip/br/deflate-encoded upstream response must be inflated here or the
// bytes we hand back are garbage for whatever Content-Type we claim.
function decompressBody(res: IncomingMessage): NodeJS.ReadableStream {
    const encoding = (res.headers["content-encoding"] || "").toLowerCase();
    switch (encoding) {
        case "gzip":
        case "x-gzip":
            return res.pipe(zlib.createGunzip());
        case "br":
            return res.pipe(zlib.createBrotliDecompress());
        case "deflate":
            return res.pipe(zlib.createInflate());
        default:
            return res;
    }
}

function readBody(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
        return new NextResponse("Missing url parameter", { status: 400 });
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(imageUrl);
    } catch {
        return new NextResponse("Invalid url parameter", { status: 400 });
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return new NextResponse("Unsupported protocol", { status: 400 });
    }

    try {
        const response = await fetchViaPinnedLookup(parsedUrl);
        const statusCode = response.statusCode || 0;

        if (statusCode >= 300 && statusCode < 400) {
            response.resume();
            return new NextResponse("Redirects are not allowed", { status: 400 });
        }

        if (statusCode < 200 || statusCode >= 300) {
            response.resume();
            console.warn(`[image-proxy] Upstream returned ${statusCode} for ${parsedUrl.hostname}`);
            return new NextResponse("Failed to fetch image", { status: 502 });
        }

        const body = await readBody(decompressBody(response));
        const headers = new Headers();
        headers.set("Content-Type", response.headers["content-type"] || "image/png");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set("Access-Control-Allow-Origin", "*");

        return new NextResponse(new Uint8Array(body), { headers });
    } catch (error) {
        console.error(`[image-proxy] Failed for ${parsedUrl.hostname}:`, error);
        return new NextResponse("Failed to proxy image", { status: 500 });
    }
}
