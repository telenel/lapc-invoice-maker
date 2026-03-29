"use client";

const LEGEND_ITEMS = [
  { label: "Catering", color: "#f97316" },
  { label: "Meeting", color: "#3b82f6" },
  { label: "Seminar", color: "#8b5cf6" },
  { label: "Birthday", color: "#ec4899" },
  { label: "Vendor", color: "#14b8a6" },
  { label: "Other", color: "#6b7280" },
];

export function EventLegend() {
  return (
    <div className="flex flex-wrap gap-3 px-3 py-2 bg-muted/50 rounded-lg">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
