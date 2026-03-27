"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface TourStep {
  selector: string | null;
  title: string;
  description: string;
  icon: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: 'a[href="/invoices/new"]',
    title: "Create an Invoice",
    description:
      "Click here to start a new invoice. Staff info, account codes, and signatures auto-fill.",
    icon: "📄",
  },
  {
    selector: 'a[href="/quotes/new"]',
    title: "Create a Quote",
    description:
      "Create quotes for cost estimates before finalizing an invoice.",
    icon: "📝",
  },
  {
    selector: null,
    title: "Staff Auto-Fill",
    description:
      "When creating an invoice, select a staff member and their department, contact info, and account numbers fill in automatically.",
    icon: "👤",
  },
  {
    selector: null,
    title: "Quick Picks",
    description:
      "The side panel shows quick-access items. Click any item to instantly add it as a line item.",
    icon: "⚡",
  },
  {
    selector: null,
    title: "Line Item Autocomplete",
    description:
      "Start typing a description to search your saved items and quick picks. Select to auto-fill the description and price.",
    icon: "🔍",
  },
  {
    selector: null,
    title: "Signatures",
    description:
      "Signature approvers are remembered per staff member. They auto-populate based on who you've used before.",
    icon: "✍️",
  },
  {
    selector: null,
    title: "Charge at Register",
    description:
      "For register-based transactions, use the Pending POS Charge workflow. The invoice is created without a number, and you add the POS charge number later after the register transaction.",
    icon: "🏪",
  },
  {
    selector: null,
    title: "PDF & Email",
    description:
      "Once an invoice is finalized, download the PDF or click Email to open your mail client with the invoice details pre-filled.",
    icon: "📧",
  },
  {
    selector: null,
    title: "Running Invoices",
    description:
      "For recurring charges like weekly department supplies, create a Running Invoice. It stays open so you can add line items over time, then finalize when ready.",
    icon: "📌",
  },
  {
    selector: 'a[href="/analytics"]',
    title: "Analytics",
    description:
      "Track spending trends, category breakdowns, and monthly totals on the Analytics page.",
    icon: "📊",
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function shouldShowTour(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("lapc-onboarding-complete") !== "true";
}

export function markTourComplete(): void {
  localStorage.setItem("lapc-onboarding-complete", "true");
}

export function resetTour(): void {
  localStorage.removeItem("lapc-onboarding-complete");
}

interface OnboardingTourProps {
  onComplete: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(
    null
  );
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  const findSpotlight = useCallback(() => {
    if (!step.selector) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (!el) {
      setSpotlightRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setSpotlightRect({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    });
  }, [step.selector]);

  useEffect(() => {
    findSpotlight();
  }, [findSpotlight]);

  useEffect(() => {
    const handleResize = () => findSpotlight();
    const handleScroll = () => findSpotlight();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [findSpotlight]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      markTourComplete();
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep, onComplete]);

  const handleSkip = useCallback(() => {
    markTourComplete();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft" && currentStep > 0) {
        setCurrentStep((prev) => prev - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handleSkip, currentStep]);

  // Scroll the spotlight target into view when it exists
  useEffect(() => {
    if (!step.selector) return;
    const el = document.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [step.selector]);

  // Calculate tooltip position relative to the spotlight
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect) {
      // Centered card
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 101,
      };
    }

    const tooltipWidth = 300;
    const tooltipGap = 16;
    const viewportHeight = window.innerHeight;
    const spotlightBottom =
      spotlightRect.top - window.scrollY + spotlightRect.height;
    const spaceBelow = viewportHeight - spotlightBottom;

    let top: number;
    let left: number;

    if (spaceBelow >= 200) {
      // Place below
      top = spotlightBottom + tooltipGap;
    } else {
      // Place above
      top = spotlightRect.top - window.scrollY - 160 - tooltipGap;
    }

    // Horizontally align with spotlight center, clamped to viewport
    left = spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    return {
      position: "fixed",
      top,
      left,
      zIndex: 101,
    };
  };

  return (
    <>
      {/* Dark overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-[100]"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          style={{
            position: "absolute",
            top: spotlightRect.top - 6,
            left: spotlightRect.left - 6,
            width: spotlightRect.width + 12,
            height: spotlightRect.height + 12,
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
            zIndex: 100,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${currentStep + 1} of ${TOUR_STEPS.length}: ${step.title}`}
      >
        <div className="bg-card rounded-xl shadow-2xl p-5 w-[300px] z-[101]">
          {/* Icon for centered (non-spotlight) steps */}
          {!spotlightRect && (
            <div className="text-3xl mb-3" aria-hidden="true">
              {step.icon}
            </div>
          )}
          <h3 className="text-base font-bold">{step.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {step.description}
          </p>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} of {TOUR_STEPS.length}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip
              </Button>
              <Button size="sm" onClick={handleNext}>
                {isLastStep ? "Done" : "Next →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
