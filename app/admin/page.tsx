// app/admin/page.tsx
import { redirect } from "next/navigation";
import { verifySession } from "@/core/auth/lib/session";
import { AdminDashboard } from "@/features/admin/ui/AdminDashboard";

export default async function AdminPage() {
    const session = await verifySession();

    if (!session || session.role !== "admin") {
        redirect("/admin/login");
    }

    return <AdminDashboard />;
}
