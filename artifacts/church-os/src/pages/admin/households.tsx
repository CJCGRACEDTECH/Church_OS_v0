import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { Home } from "lucide-react";

export default function AdminHouseholds() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Households"
        description="Household administration is not enabled for this workspace."
        icon={Home}
      />
    </AdminLayout>
  );
}
