import MemberLayout from "@/components/MemberLayout";
import ComingSoonPage from "@/components/ComingSoonPage";
import { BadgeDollarSign } from "lucide-react";

export default function MemberGive() {
  return (
    <MemberLayout>
      <ComingSoonPage
        title="Give"
        description="Make one-time or recurring online contributions and view your full giving history. Planned for a future sprint."
        icon={BadgeDollarSign}
      />
    </MemberLayout>
  );
}
