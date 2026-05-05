//src\core\lib\sanitize.ts
import DOMPurify from 'dompurify';

const isServer = typeof window === 'undefined';
const purify = isServer ? DOMPurify : DOMPurify(window);

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";

  return purify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }).trim();
}

export function sanitizeNickname(input: string): string {
  if (!input || typeof input !== "string") return "";

  let sanitized = input
    .replace(/[^a-zA-Z0-9_\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  sanitized = purify.sanitize(sanitized, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  return sanitized.slice(0, 20);
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function sanitizeRichText(input: string): string {
  if (!input || typeof input !== "string") return "";

  return purify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre'],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  });
}