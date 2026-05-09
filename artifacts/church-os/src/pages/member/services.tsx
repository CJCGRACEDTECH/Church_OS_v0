import MemberLayout from "@/components/MemberLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { CalendarDays } from "lucide-react";

export default function MemberServices() {
  return (
    <MemberLayout>
      <ComingSoonPage
        title="Services"
        description="Browse upcoming services and events happening at your church. Planned for Sprint 3."
        icon={CalendarDays}
      />
    </MemberLayout>
  );
}
