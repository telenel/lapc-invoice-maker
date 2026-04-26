import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { createAgency } from "@/domains/agency/agency-server";
import {
  ACCT_AGENCY_NAME_MAX,
  ACCT_AGENCY_NUMBER_MAX,
} from "@/domains/agency/validation";

export const dynamic = "force-dynamic";

const flagSchema = z.union([z.literal(0), z.literal(1)]);

const bodySchema = z.object({
  // Required
  agencyNumber: z.string().min(1).max(ACCT_AGENCY_NUMBER_MAX),
  name: z.string().min(1).max(ACCT_AGENCY_NAME_MAX),
  agencyTypeId: z.number().int().positive(),

  // Common-override
  tenderCode: z.number().int().nonnegative().optional(),
  creditLimit: z.number().nonnegative().optional(),
  statementCodeId: z.number().int().nonnegative().optional(),
  nonMerchOptId: z.number().int().nonnegative().optional(),
  fAccessibleOnline: flagSchema.optional(),
  fInvoiceInAR: flagSchema.optional(),
  fPrintBalance: flagSchema.optional(),
  prtStartExpDate: flagSchema.optional(),
  halfReceiptTemplateId: z.number().int().nonnegative().optional(),

  // Address
  contact: z.string().max(80).optional().nullable(),
  address: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  phone1: z.string().max(20).optional().nullable(),
  phone2: z.string().max(20).optional().nullable(),
  phone3: z.string().max(20).optional().nullable(),
  ext1: z.string().max(10).optional().nullable(),
  ext2: z.string().max(10).optional().nullable(),
  ext3: z.string().max(10).optional().nullable(),
  fedTaxNumber: z.string().max(15).optional().nullable(),

  // Advanced flags
  fDebit: flagSchema.optional(),
  fBilling: flagSchema.optional(),
  fBalanceType: flagSchema.optional(),
  fTaxExempt: flagSchema.optional(),
  fSetCredLimit: flagSchema.optional(),
  fPageBreak: flagSchema.optional(),
  fFinanceType: flagSchema.optional(),
  fFinanceCharge: flagSchema.optional(),
  fPermitChgDue: flagSchema.optional(),
  fOpenDrawer: flagSchema.optional(),
  fRefRequired: flagSchema.optional(),
  fAllowLimitChg: flagSchema.optional(),
  fDispCustCmnt: flagSchema.optional(),
  fPrtCustCmnt: flagSchema.optional(),

  // Numeric
  agencyBillingId: z.number().int().nonnegative().optional().nullable(),
  maxDays: z.number().int().nonnegative().optional(),
  priority: z.number().int().nonnegative().optional(),
  acctTermId: z.number().int().nonnegative().optional().nullable(),
  discountCodeId: z.number().int().nonnegative().optional(),
  changeLimit: z.number().nonnegative().optional(),
  mimimumCharge: z.number().nonnegative().optional(),
  financeRate: z.number().nonnegative().optional(),
  discountType: z.number().int().nonnegative().optional(),
  printInvoice: z.number().int().nonnegative().optional(),
  fullReceiptTemplateId: z.number().int().nonnegative().optional(),
  textbookValidation: z.number().int().nonnegative().optional(),
  validateTextbooksOnly: flagSchema.optional(),
});

/**
 * POST /api/agencies/create
 *
 * Create one Acct_Agency from scratch (advanced mode). The 52 MFC-bound
 * columns get caller-supplied values for what the form sends, and the
 * Pierce-empirical defaults for everything else.
 *
 * Issues:
 *   1. INSERT INTO Acct_Agency (52 cols) VALUES (52 params)
 *   2. EXEC SP_ARAcctResendToPos @AgencyID
 *
 * No DCC/NonMerch copy procs (no template).
 */
export const POST = withAdmin(async (request: NextRequest, session) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  try {
    const result = await createAgency(parsed.data);

    console.log(
      `[agency-create] user=${session.user.username}(${session.user.id}) ` +
        `agencyNumber=${result.newAgencyNumber} newId=${result.newAgencyId}`,
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
