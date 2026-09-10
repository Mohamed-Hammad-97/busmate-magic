# Print Tables tab (كشف بأسماء الطلاب)

A new tab in Routes where an employee types a line number, sees the students of that line laid out exactly like the paper sheet, and can print it or save it as PDF.

## What the employee sees

- New tab "طباعة الكشوف / Print Tables" beside Table, Map and Complete Registrations.
- A line-number box (with a dropdown of existing lines as a fallback) and a "عرض / Show" action.
- Once a line is chosen, the sheet renders on screen in the same design as the attached form:
  - Seater wordmark at the top, blue underline, title "كشف بأسماء الطلاب".
  - Info strip: خط رقم (line number), المشرفة (supervisor name, phone), السائق (driver name).
  - Main table, right-to-left, columns: tick box, مسلسل الخط (6-1, 6-2 … using the line number), اسم الطالب/ة, المدرسة, المرحلة (stage code from the grade), in the student pickup order.
  - Empty rows padded to a minimum of 15 so the sheet always looks like the printed form.
  - Footer: للطوارئ 01112811711, عدد الطلبة (count), the two Seater addresses and contact line, seater.org.
- Two buttons: "طباعة" (opens the browser print dialog, A4 portrait) and "تحميل PDF".

## Data

Students come from the line's assignments (same source as the existing Route Students dialog): student name, school name, grade, and the line's supervisor and driver names. Cancelled registrations are excluded. Grade maps to the stage code shown in the sample (KG1, J1–J5, M1–M3, S1–S3) using the existing grade helpers; if a grade has no code we print the grade as-is.

Note: the supervisor's national ID (ر.ق on the paper form) is not stored anywhere in the system today, so that field stays blank unless you want us to add it to supervisor records.

## Technical notes

- New component `src/components/routes/PrintTablesTab.tsx`, mounted as a fourth tab in `src/pages/Routes.tsx`.
- Query mirrors `RouteStudentsDialog`: `route_assignments` → `registrations` (student_name, grade, status, school via route's `schools`), ordered by `pickup_order`.
- Printing uses a print-only stylesheet (`@media print` rules scoped to the sheet container, A4 portrait, hide app chrome) — this gives the closest match to the paper design.
- PDF export reuses `src/lib/pdfArabic.ts` (`createArabicPdf`, `withArabicTable`, `rtlRow`) with a header block and footer drawn manually, so Arabic renders correctly.
- Access follows existing Routes tab permissions; no schema or backend changes.

## Verification

Open a line with students, compare the on-screen sheet against the attached form, print-preview it, and generate the PDF to check Arabic shaping, column order and row padding.
