"use client";

import { useEffect, useState } from "react";
import { productApi } from "@/domains/product/api-client";
import type { ProductEditDetails } from "@/domains/product/types";
import type { EditItemDialogProps } from "./edit-item-dialog-legacy";
import { EditItemDialogLegacy, buildPatch } from "./edit-item-dialog-legacy";
import { EditItemDialogV2 } from "./edit-item-dialog-v2";
import { resolveEditDialogMode } from "./edit-item-dialog-mode";

type EditItemDialogWrapperProps = EditItemDialogProps & {
  editDialogOverride?: string | null;
};

export { buildPatch };

export function EditItemDialog({ editDialogOverride, items, open, ...props }: EditItemDialogWrapperProps) {
  const mode = resolveEditDialogMode({
    featureFlagEnabled: process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2 === "true",
    override: editDialogOverride ?? null,
    hasTextbookSelection: items.some((item) => item.isTextbook),
  });

  const [detail, setDetail] = useState<ProductEditDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const shouldHydrateSingleItem = open && mode === "v2" && items.length === 1;
  const detailSku = shouldHydrateSingleItem ? items[0]?.sku ?? null : null;

  useEffect(() => {
    let cancelled = false;

    if (detailSku == null) {
      setDetail(null);
      setDetailLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setDetail(null);
    setDetailLoading(true);

    productApi
      .detail(detailSku)
      .then((nextDetail) => {
        if (!cancelled) {
          setDetail(nextDetail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detailSku]);

  if (mode === "v2") {
    return (
      <EditItemDialogV2
        {...props}
        open={open}
        items={items}
        detail={detail}
        detailLoading={detailLoading}
      />
    );
  }

  return <EditItemDialogLegacy {...props} open={open} items={items} />;
}
