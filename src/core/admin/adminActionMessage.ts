// src/core/admin/adminActionMessage.ts

export function buildAdminActionMessage(action: string, target: string, timestamp: number): string {
    return `TANJO Admin Action: ${action} ${target} at ${timestamp}`;
}
