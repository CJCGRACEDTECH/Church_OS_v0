import MemberLayout from "@/components/MemberLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { User } from "lucide-react";

export default function MemberProfile() {
  return (
    <MemberLayout>
      <ComingSoonPage
        title="My Profile"
        description="View and update your contact information, photo, and personal details. Planned for Sprint 2."
        icon={User}
      />
    </MemberLayout>
  );
}
