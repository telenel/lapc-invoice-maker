"use client";

import type { CateringDetails } from "@/domains/quote/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CateringDetailsCardProps {
  details: CateringDetails;
  onChange: (details: CateringDetails) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const labelClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CateringDetailsCard({ details, onChange }: CateringDetailsCardProps) {
  function updateField<K extends keyof CateringDetails>(key: K, value: CateringDetails[K]) {
    onChange({ ...details, [key]: value });
  }

  return (
    <Card className="border-orange-500/20">
      {/* Header */}
      <CardHeader className="bg-orange-500/5">
        <CardTitle className="text-orange-500">
          🍽 Catering Event Details
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Row 1 — Event Date & Time */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="catering-event-date" className={labelClass}>
              Event Date
            </Label>
            <Input
              id="catering-event-date"
              type="date"
              value={details.eventDate}
              onChange={(e) => updateField("eventDate", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catering-start-time" className={labelClass}>
              Start Time
            </Label>
            <Input
              id="catering-start-time"
              type="time"
              value={details.startTime}
              onChange={(e) => updateField("startTime", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catering-end-time" className={labelClass}>
              End Time
            </Label>
            <Input
              id="catering-end-time"
              type="time"
              value={details.endTime}
              onChange={(e) => updateField("endTime", e.target.value)}
            />
          </div>
        </div>

        {/* Row 2 — Location */}
        <div className="space-y-1.5">
          <Label htmlFor="catering-location" className={labelClass}>
            Location
          </Label>
          <Input
            id="catering-location"
            type="text"
            placeholder="Building, Room, Area"
            value={details.location}
            onChange={(e) => updateField("location", e.target.value)}
          />
        </div>

        {/* Row 3 — Contact */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="catering-contact-name" className={labelClass}>
              Contact Name
            </Label>
            <Input
              id="catering-contact-name"
              type="text"
              value={details.contactName}
              onChange={(e) => updateField("contactName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catering-contact-phone" className={labelClass}>
              Contact Phone
            </Label>
            <Input
              id="catering-contact-phone"
              type="text"
              value={details.contactPhone}
              onChange={(e) => updateField("contactPhone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catering-contact-email" className={labelClass}>
              Contact Email
            </Label>
            <Input
              id="catering-contact-email"
              type="email"
              value={details.contactEmail ?? ""}
              onChange={(e) => updateField("contactEmail", e.target.value)}
            />
          </div>
        </div>

        {/* Row 4 — Headcount & Event Name */}
        <div className="flex gap-4">
          <div className="w-[120px] shrink-0 space-y-1.5">
            <Label htmlFor="catering-headcount" className={labelClass}>
              Headcount
            </Label>
            <Input
              id="catering-headcount"
              type="number"
              min={0}
              value={details.headcount ?? ""}
              onChange={(e) =>
                updateField(
                  "headcount",
                  e.target.value === "" ? undefined : Number(e.target.value)
                )
              }
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="catering-event-name" className={labelClass}>
              Event Name / Purpose
            </Label>
            <Input
              id="catering-event-name"
              type="text"
              value={details.eventName ?? ""}
              onChange={(e) => updateField("eventName", e.target.value)}
            />
          </div>
        </div>

        {/* Row 5 — Setup & Takedown */}
        <Separator />

        <div className="grid grid-cols-2 gap-4">
          {/* Setup card */}
          <Card size="sm" className="border-orange-500/10">
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="catering-setup-required"
                  checked={details.setupRequired}
                  onCheckedChange={(checked) =>
                    updateField("setupRequired", checked === true)
                  }
                />
                <Label htmlFor="catering-setup-required" className="text-sm font-medium">
                  Setup Required
                </Label>
              </div>

              {details.setupRequired && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="catering-setup-time" className={labelClass}>
                      Setup Time
                    </Label>
                    <Input
                      id="catering-setup-time"
                      type="time"
                      value={details.setupTime ?? ""}
                      onChange={(e) => updateField("setupTime", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="catering-setup-instructions" className={labelClass}>
                      Setup Instructions
                    </Label>
                    <Input
                      id="catering-setup-instructions"
                      type="text"
                      value={details.setupInstructions ?? ""}
                      onChange={(e) => updateField("setupInstructions", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Takedown card */}
          <Card size="sm" className="border-orange-500/10">
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="catering-takedown-required"
                  checked={details.takedownRequired}
                  onCheckedChange={(checked) =>
                    updateField("takedownRequired", checked === true)
                  }
                />
                <Label htmlFor="catering-takedown-required" className="text-sm font-medium">
                  Takedown Required
                </Label>
              </div>

              {details.takedownRequired && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="catering-takedown-time" className={labelClass}>
                      Takedown Time
                    </Label>
                    <Input
                      id="catering-takedown-time"
                      type="time"
                      value={details.takedownTime ?? ""}
                      onChange={(e) => updateField("takedownTime", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="catering-takedown-instructions" className={labelClass}>
                      Takedown Instructions
                    </Label>
                    <Input
                      id="catering-takedown-instructions"
                      type="text"
                      value={details.takedownInstructions ?? ""}
                      onChange={(e) => updateField("takedownInstructions", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 6 — Special Instructions */}
        <div className="space-y-1.5">
          <Label htmlFor="catering-special-instructions" className={labelClass}>
            Special Instructions
          </Label>
          <Textarea
            id="catering-special-instructions"
            placeholder="Dietary needs, equipment, etc."
            value={details.specialInstructions ?? ""}
            onChange={(e) => updateField("specialInstructions", e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
