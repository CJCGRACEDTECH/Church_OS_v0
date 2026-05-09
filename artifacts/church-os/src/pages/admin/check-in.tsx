import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { CheckSquare } from "lucide-react";

export default function AdminCheckIn() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Sunday Check-In"
        description="Fast kiosk-style check-in for children and guests on Sunday mornings. Planned for Sprint 3."
        icon={CheckSquare}
      />
    </AdminLayout>
  );
}
