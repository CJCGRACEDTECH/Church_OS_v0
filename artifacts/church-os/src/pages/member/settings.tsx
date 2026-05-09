import MemberLayout from "@/components/MemberLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { Settings } from "lucide-react";

export default function MemberSettings() {
  return (
    <MemberLayout>
      <ComingSoonPage
        title="Settings"
        description="Manage your notification preferences, privacy settings, and account options. Planned for a future sprint."
        icon={Settings}
      />
    </MemberLayout>
  );
}
