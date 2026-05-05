//src\core\auth\lib\index.ts
export { requireAuth, verifyCSRF, type AuthResult } from "./auth";
export { generateCSRFToken, verifyCSRFToken, getCSRFSecret } from "./csrf";