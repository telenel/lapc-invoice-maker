export interface TemplateItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
  isTaxable: boolean;
  costPrice: number | null;
  marginOverride: number | null;
}

export interface TemplateResponse {
  id: string;
  name: string;
  type: "INVOICE" | "QUOTE";
  staffId: string | null;
  department: string;
  category: string;
  accountCode: string;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  taxRate: number;
  notes: string;
  isCateringEvent: boolean;
  cateringDetails: unknown;
  items: TemplateItemResponse[];
  createdAt: string;
}

export interface CreateTemplateInput {
  name: string;
  type: "INVOICE" | "QUOTE";
  staffId?: string;
  department?: string;
  category?: string;
  accountCode?: string;
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  notes?: string;
  isCateringEvent?: boolean;
  cateringDetails?: unknown;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    sortOrder?: number;
    isTaxable?: boolean;
    costPrice?: number;
    marginOverride?: number;
  }[];
}
