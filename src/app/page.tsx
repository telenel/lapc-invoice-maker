import dynamic from "next/dynamic";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { OnboardingWrapper } from "@/components/dashboard/onboarding-wrapper";
import { PersonalizedHeader } from "@/components/dashboard/personalized-header";

const DraggableDashboard = dynamic(
  () => import("@/components/dashboard/draggable-dashboard").then((m) => m.DraggableDashboard),
  { ssr: false },
);

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-3 -mt-2 pb-0">
      <OnboardingWrapper />
      <div className="dashboard-enter dashboard-enter-1">
        <WelcomeBanner />
      </div>
      <div className="dashboard-enter dashboard-enter-1">
        <PersonalizedHeader />
      </div>
      <div className="dashboard-enter dashboard-enter-2">
        <DraggableDashboard />
      </div>
    </div>
  );
}
