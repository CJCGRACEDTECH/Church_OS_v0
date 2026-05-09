import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { BarChart3 } from "lucide-react";

export default function AdminReports() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Reports"
        description="Generate and export reports on membership, attendance, giving, and growth trends. Planned for a future sprint."
        icon={BarChart3}
      />
    </AdminLayout>
  );
}
