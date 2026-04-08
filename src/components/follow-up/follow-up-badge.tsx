import { Badge } from "@/components/ui/badge";
import type { FollowUpBadgeState } from "@/domains/follow-up/types";

interface FollowUpBadgeProps {
  state: FollowUpBadgeState | null;
}

export function FollowUpBadge({ state }: FollowUpBadgeProps) {
  if (!state) return null;

  if (state.seriesStatus === "EXHAUSTED") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        No Response
      </Badge>
    );
  }

  if (state.seriesStatus === "ACTIVE") {
    return (
      <Badge className="bg-amber-500 text-[10px] text-white hover:bg-amber-600">
        Follow Up {state.currentAttempt}/{state.maxAttempts}
      </Badge>
    );
  }

  return null;
}
