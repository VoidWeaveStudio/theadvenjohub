// src/core/auth/index.ts
export { requireAuth, verifyCSRF, type AuthResult } from "./lib/auth";
export { generateCSRFToken, verifyCSRFToken } from "./lib/csrf";
export { revokeSessions, clearRevocation, isSessionRevoked } from "./lib/revocation";
