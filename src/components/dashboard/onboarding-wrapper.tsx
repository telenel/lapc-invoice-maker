"use client";

import { useState, useEffect } from "react";
import { OnboardingTour, shouldShowTour, markTourComplete } from "@/components/onboarding-tour";

export function OnboardingWrapper() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (shouldShowTour()) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => setShowTour(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!showTour) return null;

  return (
    <OnboardingTour
      onComplete={() => {
        markTourComplete();
        setShowTour(false);
      }}
    />
  );
}
