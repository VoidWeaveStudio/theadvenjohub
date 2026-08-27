// app/admin/layout.tsx
import "@/features/admin/ui/admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <div className="a-root">{children}</div>;
}
