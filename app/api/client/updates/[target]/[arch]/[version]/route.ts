// app/api/client/updates/[target]/[arch]/[version]/route.ts
import { NextRequest, NextResponse } from "next/server";

const LATEST_VERSION = "0.1.4";

const GITHUB_RELEASE_URL = "https://github.com/VoidWeaveStudio/theadvenjohub/releases/download/v0.1.4/TANJO.Game.Store_0.1.4_x64-setup.exe";

const PUBKEY = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IENGNUVCNjRCOTcwNjU4OUUKUldTZVdBYVhTN1plejFkN1EreThRbE5STFZ1Y01RbnlWSWlIenRmRmtiU1hNekNvYVFmVGxveDEK";

const SIGNATURE = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVTZVdBYVhTN1plei9FM09wTHUvM3lGUDYvNExCSUlmUW53UWJNMTdaSHZEd2xRamNUbFl4YW5qbEt1aGpkODRLTlRkL2JoWm9LVStwTUt4NXlsTUhvQUxnVDl4QXA3b3dvPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzgyMjk1NjA3CWZpbGU6VEFOSk8uR2FtZS5TdG9yZV8wLjEuNF94NjQtc2V0dXAuZXhlCmZFVHZKeTJkRTFwdVFMZXgvbm40WEtjQmRWT216bWdzUkpkN2FTRXkvRXhOdzRkTE5QQkZsazNrLzVVazJhb0diUmtLdmRhNlZBeXpVSHhObDN3V0NnPT0K";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ target: string; arch: string; version: string }> }
) {
  const { target, arch, version } = await params;
  
  if (version === LATEST_VERSION) {
    return NextResponse.json({ version: LATEST_VERSION }, { status: 204 });
  }
  
  const platformKey = `${target}-${arch}`;
  
  const response = {
    version: LATEST_VERSION,
    notes: "Added language selector, multilingual support, bug fixes", 
    pub_date: new Date().toISOString(),
    platforms: {
      [platformKey]: {
        url: GITHUB_RELEASE_URL,
        signature: SIGNATURE
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
}