//src\core\auth\index.ts
export { requireAuth, verifyCSRF, type AuthResult } from "./lib/auth";
export { generateCSRFToken, verifyCSRFToken, getCSRFSecret } from "./lib/csrf";
export { LoginWithPhantom } from "./components/LoginWithPhantom";