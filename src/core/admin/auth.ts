//src\core\admin\auth.ts
import jwt from "jsonwebtoken";

export interface AdminPayload {
    wallet: string;
    role: string;
    userId: string;
}

export function verifyAdminToken(token: string): AdminPayload | null {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
        console.error("JWT_SECRET not configured");
        return null;
    }

    try {
        const decoded = jwt.verify(token, jwtSecret, {
            issuer: "tanjo-store",
            audience: "tanjo-admins"
        }) as AdminPayload;

        return decoded;
    } catch (error) {
        console.error("Invalid admin token:", error);
        return null;
    }
}

export function createAdminToken(payload: AdminPayload): string {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
        throw new Error("JWT_SECRET not configured");
    }

    return jwt.sign(payload, jwtSecret, {
        issuer: "tanjo-store",
        audience: "tanjo-admins",
        expiresIn: "24h"
    });
}