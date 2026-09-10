# Arabic support in PDF exports

Right now every PDF the system creates uses the built-in Helvetica font, which has no Arabic letters. Student names, school names, addresses and note text written in Arabic come out as empty boxes or garbled characters, and lines are laid out left-to-right.

## What will change

All PDF downloads will print Arabic correctly, with joined letters, correct right-to-left word order, and right-aligned tables when the user is in Arabic:

- Payments export (records + installment details)
- Registrations export
- Route students export
- Corporate invoices
- Payment invoice generator

Column headers and labels will follow the language the employee is using: Arabic headings in Arabic mode, English in English mode. Numbers, dates and money values stay in western digits so they remain easy to read and searchable.

## How it works (technical)

1. Add an Arabic-capable font (Noto Naskh Arabic, regular + bold) as a base64 TTF asset and register it with jsPDF.
2. New shared helper `src/lib/pdfArabic.ts`:
   - `createArabicPdf(orientation)` — returns a jsPDF instance with the Arabic font registered and set as default.
   - `ar(text)` — shapes Arabic text and applies bidi ordering so mixed Arabic/Latin/number strings render correctly.
   - `arabicTableOptions(isRtl)` — autoTable defaults: `halign: 'right'`, RTL column order, Arabic font in `styles`, `headStyles`, and `bodyStyles`.
3. Refactor `src/lib/exportPayments.ts`, `src/lib/exportRegistrations.ts`, `src/components/routes/RouteStudentsDialog.tsx`, `src/components/payments/InvoiceGenerator.tsx`, and `src/components/corporate/CompanyInvoices.tsx` to build documents through the helper instead of raw `new jsPDF()`.
4. Pass the current language into each export function (from the existing i18n context) so headers, titles and the "Generated" line are localized and column order flips for Arabic.
5. Excel exports keep their current behaviour — they already handle Arabic.

## Verification

Generate one PDF from each export path with Arabic sample data and visually inspect the rendered pages for missing glyphs, reversed words, clipped cells, and column alignment.
