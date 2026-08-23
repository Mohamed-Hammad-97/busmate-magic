# Fix corporate invoice shift calculation

## Problem

When creating an invoice in Corporate Management > Invoices, the shift count is wrong. The current code collapses all attendance records of a line into unique shift numbers only, ignoring the date. So a line with one shift per day attended on 20 days in August is counted as **1 shift** instead of **20**.

Confirmed in the data: one line has 20 attended records across 20 days (Aug 1–23) with a rate total of 17,000, but the invoice would bill a single shift.

## Fix

Count every attended attendance record inside the selected period, per line:

- Count = number of `is_present` attendance rows in the period for that line (unique per line + date + shift number, so a real duplicate entry is still counted once, but different days are counted separately).
- Amount = sum of the `shift_rate` stored on each attendance record (the price snapshot at the time), which is accurate even if the line price changed mid-period.
- Add any per-attendance extra fees as their own line so they appear on the invoice and in the total.
- Show the effective rate per shift in the preview table (average when rates differ within the period).

## Preview improvements

- Lines with zero attended shifts in the period are hidden from the invoice (currently they show as 0-value rows).
- Show a small summary under the preview: number of days in the period, total shifts, extra fees, and grand total, so the amount can be checked before saving.
- If no attendance exists for the chosen dates, show a clear message instead of an empty/zero invoice.

## Technical notes

- File: `src/components/corporate/CompanyInvoices.tsx`.
- The attendance query already filters `attendance_date` between `period_start` and `period_end` and `is_present = true`; it needs `attendance_date` and `extra_fee_amount`/`extra_fee_reason` added to the selected columns.
- Replace the `uniqueShifts` Set keyed on `line_id-shift_number` with a key that includes `attendance_date`.
- Stored `line_items` keep the same shape (`line_name`, `shifts_count`, `price_per_shift`, `total`, optional `is_extra`) so existing invoices and the PDF export keep working.
- No database changes; existing invoices are not recalculated retroactively.
