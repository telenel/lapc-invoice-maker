export interface CoverSheetData {
  date: string;
  semesterYearDept: string;
  invoiceNumber: string;
  chargeAccountNumber: string;
  accountCode: string;
  totalAmount: string;
  signatures: { name: string; title?: string }[];
}

export interface IDPOverlayData {
  date: string;
  department: string;
  documentNumber: string;
  requestingDept: string;
  sapAccount: string;
  estimatedCost: string;
  approverName: string;
  contactName: string;
  contactPhone: string;
  comments?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: string;
    extendedPrice: string;
  }[];
  totalAmount: string;
}

export interface QuotePDFCateringDetails {
  eventName?: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  headcount?: number;
  setupRequired: boolean;
  setupTime?: string;
  setupInstructions?: string;
  takedownRequired: boolean;
  takedownTime?: string;
  takedownInstructions?: string;
  specialInstructions?: string;
}

export interface QuotePDFData {
  quoteNumber: string;
  date: string;
  expirationDate: string;
  recipientName: string;
  recipientEmail: string;
  recipientOrg: string;
  department: string;
  category: string;
  accountCode: string;
  notes: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: string;
    extendedPrice: string;
    isTaxable: boolean;
    costPrice: string | null;
  }[];
  totalAmount: number;
  marginEnabled: boolean;
  taxEnabled: boolean;
  taxRate: number;
  isCateringEvent: boolean;
  cateringDetails: QuotePDFCateringDetails | null;
  shareToken?: string | null;
  appUrl?: string;
}

export interface GenerateInvoicePDFInput {
  coverSheet: CoverSheetData;
  idp: IDPOverlayData;
}
