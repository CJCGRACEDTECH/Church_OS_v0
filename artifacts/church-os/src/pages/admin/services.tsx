import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { CalendarDays } from "lucide-react";

export default function AdminServices() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Services"
        description="Plan, schedule, and manage church services, events, and programs. Planned for Sprint 3."
        icon={CalendarDays}
      />
    </AdminLayout>
  );
}
