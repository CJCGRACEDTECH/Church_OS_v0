import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { Home } from "lucide-react";

export default function AdminHouseholds() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Households"
        description="Group and manage church families together under a single household record. Planned for Sprint 2."
        icon={Home}
      />
    </AdminLayout>
  );
}
