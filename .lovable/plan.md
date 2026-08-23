# Invoices: bill at the line price, not the driver rate

## Problem

When building a corporate invoice, each attended shift is priced from `shift_rate` stored on the attendance record. That value is the driver's cost per shift, so invoices bill the company the driver payout instead of the agreed client price.

## Change

In the invoice builder (`src/components/corporate/CompanyInvoices.tsx`):

- Price every counted shift with the line's `price_per_shift` (the company invoice price), ignoring `shift_rate`.
- Line total = shifts counted x line price; the displayed per-shift rate becomes the exact line price instead of an averaged rate.
- Keep everything else as-is: shift counting/deduping per line + date + shift number, attendance extra fees, and manual extra items.

## Notes

Driver cost (`driver_rate_per_shift` / attendance `shift_rate`) stays untouched and remains used only for driver salary calculations, and stays hidden from company-facing views.
