// app/api/client/updates/[target]/[arch]/[version]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ target: string; arch: string; version: string }> }
) {
  const { target, arch, version } = await params;
  
  const LATEST_VERSION = "0.1.3";
  
  if (version === LATEST_VERSION) {
    return NextResponse.json({ version: LATEST_VERSION }, { status: 204 });
  }
  
  const platformKey = `${target}-${arch}`;
  
  const installerFilename = platformKey.includes("windows") 
    ? "TANJO-Client-latest.exe"
    : platformKey.includes("darwin")
    ? "TANJO-Client-latest.dmg"
    : "TANJO-Client-latest.AppImage";
  
  const sigFilename = `${installerFilename}.sig`;
  
  try {
    const { blobs } = await list({ prefix: "releases/" });
    
    const installerBlob = blobs.find(b => b.pathname === `releases/${installerFilename}`);
    if (!installerBlob) {
      console.error(`[Updater] Installer not found: ${installerFilename}`);
      return NextResponse.json(
        { error: "Installer not found" },
        { status: 404 }
      );
    }
    
    const sigBlob = blobs.find(b => b.pathname === `releases/${sigFilename}`);
    if (!sigBlob) {
      console.error(`[Updater] Signature file not found: ${sigFilename}`);
      return NextResponse.json(
        { error: "Signature file not found" },
        { status: 404 }
      );
    }
    
    const signatureResponse = await fetch(sigBlob.downloadUrl || sigBlob.url);
    const signature = (await signatureResponse.text()).trim();
    
    if (!signature) {
      console.error(`[Updater] Empty signature file: ${sigFilename}`);
      return NextResponse.json(
        { error: "Empty signature file" },
        { status: 500 }
      );
    }
    
    const response = {
      version: LATEST_VERSION,
      notes: "Added support for all Solana wallets, multilingual support, bug fixes", 
      pub_date: new Date().toISOString(),
      platforms: {
        [platformKey]: {
          url: installerBlob.downloadUrl || installerBlob.url,
          signature: signature
        }
      }
    };
    
    console.log(`[Updater] Update available: ${version} -> ${LATEST_VERSION} for ${platformKey}`);
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
    
  } catch (error) {
    console.error("[Updater] Error:", error);
    return NextResponse.json(
      { error: "Update check failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}