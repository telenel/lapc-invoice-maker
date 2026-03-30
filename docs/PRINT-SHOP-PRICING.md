# Print Shop Pricing Notes

## Where The Pricing Logic Lives

- Core cents-based pricing engine: `src/lib/pricing/print-shop-pricing.ts`
- Input and admin validation: `src/lib/pricing/validators.ts`
- Database-backed config + quote orchestration: `src/domains/print-pricing/service.ts`

## How To Edit Pricing

- Admin UI: `/admin/pricing`
- Database seed defaults: `src/domains/print-pricing/defaults.ts`
- Public calculator: `/pricing-calculator`

The admin page writes pricing rules to PostgreSQL through `PrintPricingConfig` and `PrintPricingTier`, so pricing changes do not require a redeploy.

## How To Extend Services Later

- Add any new service-specific tier or fixed-price rules to `PrintPricingTier`
- Extend the estimate input union in `src/lib/pricing/print-shop-pricing.ts`
- Add validation in `src/lib/pricing/validators.ts`
- Update the public calculator UI and PDF mapping in `src/components/pricing/` and `src/lib/pdf/templates/print-quote.ts`

The current schema separates pricing configuration from saved quotes so historical quotes keep their own line-item snapshots even after pricing changes.
