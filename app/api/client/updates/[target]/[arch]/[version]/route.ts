//app\api\client\updates\[target]\[arch]\[version]\route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ target: string; arch: string; version: string }> }
) {
  const { target, arch, version } = await params;
  
  const LATEST_VERSION = "0.1.0";
  
  if (version === LATEST_VERSION) {
    return NextResponse.json({ version: LATEST_VERSION }, { status: 204 });
  }
  
  const platformKey = `${target}-${arch}`;
  
  const releasesDir = path.join(process.cwd(), "..", "releases");
  const installerFilename = platformKey.includes("windows") 
    ? "TANJO-Client-latest.exe"
    : platformKey.includes("darwin")
    ? "TANJO-Client-latest.dmg"
    : "TANJO-Client-latest.AppImage";
  
  const sigPath = path.join(releasesDir, `${installerFilename}.sig`);
  const signature = fs.existsSync(sigPath)
    ? fs.readFileSync(sigPath, "utf-8").trim()
    : "";
  
  if (!signature) {
    console.error(`[Updater] Signature file not found: ${sigPath}`);
  }
  
  const response = {
    version: LATEST_VERSION,
    notes: "Bug fixes and improvements", 
    pub_date: new Date().toISOString(),
    platforms: {
      [platformKey]: {
        url: `https://theadvenjo.online/api/client/download`,
        signature: signature || "INVALID_SIGNATURE_MISSING_SIG_FILE"
      }
    }
  };
  
  return NextResponse.json(response);
}