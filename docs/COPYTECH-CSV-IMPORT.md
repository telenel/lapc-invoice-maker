# CopyTech CSV Import

Upload CopyTech job rows as CSV to generate draft LAPortal invoices.

The importer can accept a full CopyTech export, including jobs that are not billed. Rows with `chargeable` set to `FALSE` are skipped. Rows with `chargeable` set to `TRUE`, or with `chargeable` omitted for older exports, are resolved against the product catalog and turned into draft invoice line items.

## API

- `GET /api/copytech/import` returns the required headers, optional headers, example CSV, and format notes.
- `POST /api/copytech/import?mode=preview` validates a CSV upload and returns invoice previews.
- `POST /api/copytech/import?mode=commit` validates the CSV upload and creates draft invoices when there are no validation errors.

Both `POST` modes expect `multipart/form-data` with the CSV in a file field named `file`.

## Required Headers

```csv
invoice_date,department,account_number,sku,quantity
```

## Optional Headers

```csv
requester_name,account_code,job_id,job_date,description_override,unit_price_override,notes,chargeable,charge_reason,raw_impressions
```

## Full Example

```csv
invoice_date,department,account_number,sku,quantity,requester_name,account_code,job_id,job_date,description_override,unit_price_override,notes,chargeable,charge_reason,raw_impressions
2026-03-31,Library,12345,100234,120,Jane Smith,,CT-1001,2026-03-08,,,Color flyer run,TRUE,COLOR,120
2026-03-31,Library,12345,100450,2,Jane Smith,,CT-1002,2026-03-12,A-frame sign,,Student event signage,TRUE,A_FRAME,2
2026-03-31,Library,12345,,0,Jane Smith,,CT-1003,2026-03-12,,,Under threshold B&W run,FALSE,NOT_CHARGEABLE,80
```

## Rules

- `chargeable` accepts `TRUE/FALSE`, `yes/no`, `y/n`, or `1/0`. Blank or missing values default to `TRUE`.
- Rows marked `chargeable=FALSE` are counted as skipped and do not create invoice lines.
- For chargeable rows, `invoice_date` and `job_date` must be `YYYY-MM-DD`.
- For chargeable rows, `sku` must be a positive whole number and must exist in the LAPortal product catalog.
- For chargeable rows, `quantity` must be a positive number. For B&W overage rows, use only the billable over-500 amount as `quantity`.
- Non-chargeable rows may use `quantity` `0` and may leave `sku` blank.
- `unit_price_override` is optional. If blank, the product retail price is used.
- `description_override` is optional. If blank, the product description is used.
- `charge_reason` is optional audit context. Suggested values are `COLOR`, `A_FRAME`, `POSTER`, `BW_OVER_500`, and `NOT_CHARGEABLE`.
- `raw_impressions` is optional and can store the original job impression count when `quantity` is only the billable amount.
- Rows with the same `invoice_date`, `department`, `account_number`, `account_code`, and `requester_name` are grouped into one draft invoice.
- Duplicate `job_id` values among chargeable rows in the same CSV are rejected.

## Prompt For The Excel Export Machine

```text
Update the CopyTech Excel export so it writes a LAPortal-ready CSV for invoice upload.

Target CSV headers, in this order:
invoice_date,department,account_number,sku,quantity,requester_name,account_code,job_id,job_date,description_override,unit_price_override,notes,chargeable,charge_reason,raw_impressions

Backend behavior already implemented in LAPortal:
- Upload page: /copytech/import
- API: POST /api/copytech/import?mode=preview or ?mode=commit with multipart file field named file.
- LAPortal imports only rows where chargeable is TRUE, yes, y, or 1.
- chargeable blank/missing defaults to TRUE, but this export should always write TRUE or FALSE.
- Rows where chargeable is FALSE are skipped and may have blank sku and quantity 0.
- Chargeable rows must have invoice_date, department, account_number, sku, and positive quantity.
- sku must be the exact product SKU from the LAPortal/PRISM product catalog.
- quantity must be the billable quantity, not necessarily the raw impressions.
- raw_impressions should store the original job impression count.
- charge_reason should be one of: COLOR, A_FRAME, POSTER, BW_OVER_500, NOT_CHARGEABLE.

Chargeability rules:
- Color jobs are chargeable.
- A-frame jobs are chargeable.
- Poster jobs are chargeable.
- Black-and-white jobs are chargeable only for impressions over 500 per department per calendar month.
- For B&W overage, quantity must be only the overage amount being charged.
- For B&W jobs under the monthly threshold, write chargeable FALSE and quantity 0.

Monthly B&W overage handling:
- Group B&W impressions by department and calendar month.
- Track the running monthly B&W total per department.
- The first 500 B&W impressions per department per month are not chargeable.
- If one job crosses the 500 threshold, split logically on that row by setting quantity to only the impressions above the threshold for that job.
- Example: department has 480 prior B&W impressions and the next job has 80. raw_impressions is 80, chargeable TRUE, charge_reason BW_OVER_500, quantity 60.

Row output rules:
- Include all jobs in the CSV, even non-chargeable jobs, so LAPortal can show skipped row counts during preview.
- For non-chargeable rows, write chargeable FALSE, charge_reason NOT_CHARGEABLE, quantity 0, and raw_impressions as the original impressions.
- For chargeable rows, write chargeable TRUE and the correct charge_reason.
- Use YYYY-MM-DD for invoice_date and job_date.
- invoice_date should be the invoice period end date or upload billing date we choose for that batch.
- job_date should be the original CopyTech job date.
- department and account_number must match the department/account that should receive the draft invoice.
- requester_name, account_code, job_id, description_override, unit_price_override, and notes are optional but should be filled when available.
- Leave unit_price_override blank unless there is an approved reason to override the product catalog price.
- Escape CSV values correctly, including commas, quotes, and line breaks.

Return a real .csv file, not Excel-only formatting. Before saving, validate:
- Required headers are present exactly as listed.
- Every row has chargeable TRUE or FALSE.
- Every chargeable row has a positive numeric quantity and numeric SKU.
- Every non-chargeable row has quantity 0.
- Dates are YYYY-MM-DD.
- No duplicate job_id appears among chargeable rows.
```
