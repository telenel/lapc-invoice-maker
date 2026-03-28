"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { staffApi } from "@/domains/staff/api-client";

interface AutoSaveFields {
  staffId: string;
  contactExtension: string;
  contactEmail: string;
  contactPhone: string;
  department: string;
}

/**
 * Debounced effect: when contactExtension/contactEmail/contactPhone/department
 * change and differ from the originally-loaded values, PATCHes the staff record.
 */
export function useStaffAutoSave(
  fields: AutoSaveFields,
  originalStaffRef: React.MutableRefObject<{
    extension: string;
    email: string;
    phone: string;
    department: string;
  } | null>
) {
  useEffect(() => {
    if (!fields.staffId || !originalStaffRef.current) return;

    const orig = originalStaffRef.current;
    const changed =
      fields.contactExtension !== orig.extension ||
      fields.contactEmail !== orig.email ||
      fields.contactPhone !== orig.phone ||
      fields.department !== orig.department;

    if (!changed) return;

    const timer = setTimeout(async () => {
      // Re-check that the ref is still current (staff may have changed)
      if (!originalStaffRef.current) return;
      try {
        const patchData = {
          extension: fields.contactExtension,
          email: fields.contactEmail,
          phone: fields.contactPhone,
          department: fields.department,
        };
        await staffApi.partialUpdate(fields.staffId, patchData);
        // Update baseline so next change detection is relative to saved values
        originalStaffRef.current = {
          extension: fields.contactExtension,
          email: fields.contactEmail,
          phone: fields.contactPhone,
          department: fields.department,
        };
        toast.success("Staff info saved", { duration: 1500 });
      } catch {
        // Silently ignore auto-save network failures
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    fields.staffId,
    fields.contactExtension,
    fields.contactEmail,
    fields.contactPhone,
    fields.department,
    originalStaffRef,
  ]);
}
