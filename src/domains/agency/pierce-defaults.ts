/**
 * Pierce-empirical defaults for Acct_Agency creates from scratch.
 * Derived from sampling 1,072 Pierce agencies — see
 * docs/prism/static/actions/create-ar-agency.md §6.
 *
 * For the clone path, ignore this — clones inherit values from the source row
 * directly via INSERT..SELECT. These constants are only used when laportal
 * creates a brand-new agency without a template.
 */
export const PIERCE_AGENCY_DEFAULTS = Object.freeze({
  fDebit: 0,
  AgencyBillingID: null as number | null,
  MaxDays: 30,
  Priority: 0,
  StatementCodeID: 6, // Month End
  AcctTermID: null as number | null,
  DiscountCodeID: 0,
  ChangeLimit: 0,
  MimimumCharge: 0, // intentional misspelling — matches schema
  FinanceRate: 0,
  FedTaxNumber: null as string | null,
  Contact: null as string | null,
  Address: null as string | null,
  City: null as string | null,
  State: null as string | null,
  Country: null as string | null,
  PostalCode: null as string | null,
  Phone1: null as string | null,
  Phone2: null as string | null,
  Phone3: null as string | null,
  Ext1: null as string | null,
  Ext2: null as string | null,
  Ext3: null as string | null,
  fBilling: 1,
  fBalanceType: 1,
  fFinanceType: 0,
  fFinanceCharge: 0,
  fTaxExempt: 0,
  fSetCredLimit: 0,
  fPageBreak: 0,
  TenderCode: 12, // A/R CHARGE — for grants the caller passes 49 (PIERCE EOPS*)
  DiscountType: 0,
  PrintInvoice: 0,
  fPermitChgDue: 0,
  fOpenDrawer: 0,
  fRefRequired: 0,
  fAllowLimitChg: 0,
  HalfReceiptTemplateID: 0,
  FullReceiptTemplateID: 0,
  fInvoiceInAR: 1, // the AR-billable switch
  NonMerchOptID: 2, // All Non-Merch
  fPrintBalance: 0,
  fDispCustCmnt: 0,
  fPrtCustCmnt: 0,
  PrtStartExpDate: 0,
  TextbookValidation: 0,
  ValidateTextbooksOnly: 0,
});

/**
 * The Pierce filter for AgencyNumber. Agencies are global at the Prism level
 * (Acct_Agency has no LocationID), so we filter by naming convention.
 *
 * Pierce convention: P + season + YY + suffix.
 *   - season is 1 or 2 letters (PSP/PFA/PSU/PWI; older variants PW/PS/etc.)
 */
export const PIERCE_AGENCY_NUMBER_PREFIXES: ReadonlyArray<string> = Object.freeze([
  "PSP", // Pierce Spring
  "PFA", // Pierce Fall
  "PSU", // Pierce Summer
  "PWI", // Pierce Winter
  "PW", // older Winter variant (single-letter)
  "PS", // older Spring/Summer variant
  "PF", // older Fall variant
]);

/**
 * Returns true if the given AgencyNumber matches the Pierce naming convention.
 */
export function isPierceAgencyNumber(agencyNumber: string): boolean {
  const trimmed = agencyNumber.trim();
  return PIERCE_AGENCY_NUMBER_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}
