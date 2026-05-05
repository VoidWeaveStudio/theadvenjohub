//src\core\lib\shortId.ts
export function shortId(uuid: string): string {
  if (!uuid || typeof uuid !== "string") return "???";
  return uuid.split("-")[0];
}

export function isShortId(id: string): boolean {
  return /^[a-f0-9]{8}$/.test(id);
}