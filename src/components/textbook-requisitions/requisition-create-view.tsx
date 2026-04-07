"use client";

import { useRouter } from "next/navigation";
import { requisitionApi } from "@/domains/textbook-requisition/api-client";
import { RequisitionForm } from "./requisition-form";
import { toast } from "sonner";
import type { CreateRequisitionInput } from "@/domains/textbook-requisition/types";

// ── Component ──

export function RequisitionCreateView() {
  const router = useRouter();

  async function handleSubmit(data: CreateRequisitionInput) {
    try {
      const result = await requisitionApi.create(data);
      toast.success("Requisition created successfully");
      router.push(`/textbook-requisitions/${result.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create requisition";
      toast.error(message);
      throw err;
    }
  }

  function handleCancel() {
    router.push("/textbook-requisitions");
  }

  return (
    <RequisitionForm
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitLabel="Create Requisition"
    />
  );
}
