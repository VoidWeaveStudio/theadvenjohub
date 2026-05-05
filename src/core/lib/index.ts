//src\core\lib\index.ts
export { sanitizeInput, sanitizeNickname, escapeHtml } from "./sanitize";
export { shortId, isShortId } from "./shortId";
export { checkRateLimit, resetRateLimit } from "./rateLimit";
export { getCookie, getCsrfToken, formatDate, formatDateTime, getAuthorName } from "./clientUtils";