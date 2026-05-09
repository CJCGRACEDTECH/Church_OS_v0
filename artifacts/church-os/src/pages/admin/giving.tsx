import AdminLayout from "@/components/AdminLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { BadgeDollarSign } from "lucide-react";

export default function AdminGiving() {
  return (
    <AdminLayout>
      <ComingSoonPage
        title="Giving"
        description="Track tithes, offerings, and online giving with donor statements and fund reporting. Planned for a future sprint."
        icon={BadgeDollarSign}
      />
    </AdminLayout>
  );
}
