import MemberLayout from "@/components/MemberLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { Users } from "lucide-react";

export default function MemberHousehold() {
  return (
    <MemberLayout>
      <ComingSoonPage
        title="My Household"
        description="View and manage your household members and family connections at your church. Planned for Sprint 2."
        icon={Users}
      />
    </MemberLayout>
  );
}
