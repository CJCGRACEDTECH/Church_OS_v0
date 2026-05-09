import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { Users } from "lucide-react";

export default function AdminMembers() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Members"
        description="The member directory lets you add, view, edit, and manage all church members. Planned for Sprint 2."
        icon={Users}
      />
    </AdminLayout>
  );
}
