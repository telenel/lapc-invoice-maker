"use client";

import { useRouter } from "next/navigation";
import { useRequisition } from "@/domains/textbook-requisition/hooks";
import { requisitionApi } from "@/domains/textbook-requisition/api-client";
import { RequisitionForm } from "./requisition-form";
import { toast } from "sonner";
import type { UpdateRequisitionInput } from "@/domains/textbook-requisition/types";

// ── Types ──

interface RequisitionEditViewProps {
  id: string;
}

// ── Component ──

export function RequisitionEditView({ id }: RequisitionEditViewProps) {
  const router = useRouter();
  const { data, loading, error } = useRequisition(id);

  if (loading) {
    return <p className="text-muted-foreground text-sm py-8">Loading requisition...</p>;
  }

  if (error || !data) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive text-sm">
          {error?.message ?? "Requisition not found"}
        </p>
      </div>
    );
  }

  async function handleSubmit(formData: UpdateRequisitionInput) {
    try {
      await requisitionApi.update(id, formData);
      toast.success("Requisition updated successfully");
      router.push(`/textbook-requisitions/${id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update requisition";
      toast.error(message);
      throw err;
    }
  }

  function handleCancel() {
    router.push(`/textbook-requisitions/${id}`);
  }

  return (
    <RequisitionForm
      initialData={data}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isEdit
      submitLabel="Save Changes"
    />
  );
}
