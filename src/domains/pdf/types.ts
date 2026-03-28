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
  }[];
  totalAmount: number;
}

export interface GenerateInvoicePDFInput {
  coverSheet: CoverSheetData;
  idp: IDPOverlayData;
}
