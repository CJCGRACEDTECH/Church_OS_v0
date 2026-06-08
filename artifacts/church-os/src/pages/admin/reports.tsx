import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { BarChart3 } from "lucide-react";

export default function AdminReports() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Reports"
        description="Reporting access is not enabled for this workspace."
        icon={BarChart3}
      />
    </AdminLayout>
  );
}
