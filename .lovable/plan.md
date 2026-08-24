# School Management: attendance, advances, coverage and salaries

Rework the School Management section so it works on **school routes** (خطوط المدارس) instead of corporate company lines, and add the payroll pieces needed to compute monthly salaries for school drivers and supervisors.

## Tabs

School Management gets these tabs:

1. حضور السائقين (Drivers attendance)
2. حضور المشرفين (Supervisors attendance)
3. السلف (Advances)
4. التغطية (Coverage)
5. ملفات الموظفين (existing staff files)
6. المرتبات (Salaries — finance only)

## 1 & 2 — Attendance (drivers / supervisors)

- Rows come from the **routes** table (school routes) with their assigned driver / supervisor, school name and route number. Corporate company lines no longer appear here.
- Filters: date, school, and route.
- Two shifts per day per person: ذهاب (morning) and عودة (return); each a checkbox.
- Drivers tab lists only routes with an assigned driver; supervisors tab only routes with an assigned supervisor.
- Only working days Sunday–Thursday are considered part of the month; a Friday/Saturday date shows a note that it is a weekend.
- A per-person "خصم إضافي" (extra deduction) amount + reason can be entered on the day row.

## 3 — السلف (Advances)

New records per driver/supervisor: date, amount, notes, who recorded it. List with month filter, add / edit / delete. Total advances in a month are deducted from that month's salary.

## 4 — التغطية (Coverage)

A coverage record says: on date X, person A (absent/covered) was covered by person B on route R, for amount M.
- Amount M is **deducted** from person A's salary and **added** to person B's salary for that month.
- List with month filter, add / edit / delete.

## 5 — Salaries calculation

- Employee enters a **monthly cost** (الراتب الشهري) per driver / supervisor. Stored per person per month so history is kept, with the last entered value pre-filled for new months.
- The month's working days = all Sunday–Thursday days in the calendar month.
- Daily rate = monthly cost ÷ working days.
- Absence deduction is shown two ways side by side: the auto value (absent days × daily rate) and an editable field the employee can override per person per month. The employee decides which value is applied (override wins when filled).
- Final salary =
  `monthly cost − advances (سلف) − coverage deducted + coverage earned − absence deduction − extra deductions`
- The salary table shows each component in its own column, the net total, and keeps the existing "record payment" action (amount pre-filled with the net).

## Technical notes

New tables (all with RLS + grants, employee/super-admin access; finance-only for salary amounts):

- `school_attendance` — route_id, driver_id / supervisor_id, attendance_date, shift (`morning` | `return`), is_present, extra_deduction_amount, extra_deduction_reason.
- `staff_advances` — driver_id / supervisor_id, amount, advance_date, notes, created_by.
- `staff_coverage` — coverage_date, route_id, covered_driver_id / covered_supervisor_id, covering_driver_id / covering_supervisor_id, amount, notes, created_by.
- `staff_monthly_salaries` — driver_id / supervisor_id, month (first day of month), monthly_cost, absence_deduction_override, notes.

Frontend:

- New `src/components/school/SchoolAttendance.tsx` (shared by the drivers and supervisors tabs via a `personType` prop), `StaffAdvances.tsx`, `StaffCoverage.tsx`, and `SchoolSalaries.tsx`.
- `src/pages/SchoolManagement.tsx` wires the new tabs; `CorporateAttendance` / `SalaryManagement` stay untouched for the corporate section.
- All labels bilingual through the existing i18n keys; edit rights follow the current `operations` / `finance` / super-admin rules (salary amounts, advances and coverage editable by finance + super admin, attendance by operations).
