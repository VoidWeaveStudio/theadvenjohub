// app/admin/page.tsx
import { redirect } from "next/navigation";
import { verifySession } from "@/core/auth/lib/session";
import { AdminDashboard } from "@/features/admin/ui/AdminDashboard";

export default async function AdminPage() {
    const session = await verifySession();

    if (!session || session.role !== "admin") {
        redirect("/admin/login");
    }

    return (
        <div className="min-h-screen bg-black p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <h1 className="text-white text-2xl font-bold">Admin Panel</h1>
                <AdminDashboard />
            </div>
        </div>
    );
}
