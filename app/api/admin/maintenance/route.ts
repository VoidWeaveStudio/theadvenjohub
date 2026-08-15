// app/api/admin/maintenance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { getMaintenanceStatus, setMaintenanceStatus } from "@/core/lib/maintenance";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    const status = await getMaintenanceStatus();
    return NextResponse.json(status);
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const { enabled, message } = body;

        if (typeof enabled !== "boolean") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, enabled ? "maintenance_on" : "maintenance_off", "global");
        if (sigError) return sigError;

        await setMaintenanceStatus(enabled, typeof message === "string" ? message.slice(0, 500) : undefined);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[admin/maintenance] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
