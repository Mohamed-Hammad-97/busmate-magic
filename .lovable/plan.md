# Show education stage beside grade

Grades are stored as `KG1`, `KG2`, `Grade 1` … `Grade 12`. Add the Arabic stage name next to the grade number wherever a record's grade is displayed.

## Mapping

- Grade 1–6 → ابتدائى
- Grade 7–9 → اعدادى
- Grade 10–12 → ثانوى
- KG1 / KG2 → no stage label (shown as-is)

## Where it appears

- Registrations tab: the grade chip on each record card becomes e.g. `Grade 5 · ابتدائى`.
- Complete Registrations window (Routes tab): grade column shows the same combined label.

Display only — stored data stays unchanged, so filters, exports and route logic keep working.

## Technical notes

- Add a small helper `getGradeStage(grade)` / `formatGrade(grade)` in `src/lib/utils.ts` that parses the numeric part of the grade string and returns the stage.
- Use it in `src/pages/Registrations.tsx` (grade badge) and `src/components/routes/CompleteRegistrationsTab.tsx` (grade cell).
