//app\api\image-proxy\route.ts
import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

async function assertPublicHost(hostname: string) {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0 || addresses.some((addr) => isPrivateIp(addr.address))) {
        throw new Error("host_not_allowed");
    }
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
        await assertPublicHost(parsedUrl.hostname);
    } catch {
        return new NextResponse("Host not allowed", { status: 400 });
    }

    try {
        const response = await fetch(parsedUrl.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
            redirect: "manual",
        });

        if (response.status >= 300 && response.status < 400) {
            return new NextResponse("Redirects are not allowed", { status: 400 });
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();
        const headers = new Headers();
        headers.set("Content-Type", blob.type || "image/png");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set("Access-Control-Allow-Origin", "*");

        return new NextResponse(blob, { headers });
    } catch (error) {
        return new NextResponse("Failed to proxy image", { status: 500 });
    }
}
