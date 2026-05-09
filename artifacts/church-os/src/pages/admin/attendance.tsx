import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { BarChart3 } from "lucide-react";

export default function AdminAttendance() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Attendance"
        description="Track and report attendance across services and events with historical trends. Planned for Sprint 3."
        icon={BarChart3}
      />
    </AdminLayout>
  );
}
