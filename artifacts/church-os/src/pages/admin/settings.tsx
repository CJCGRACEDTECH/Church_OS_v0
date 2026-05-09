import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { Settings } from "lucide-react";

export default function AdminSettings() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Settings"
        description="Configure your church profile, branding, user roles, and integrations. Planned for a future sprint."
        icon={Settings}
      />
    </AdminLayout>
  );
}
