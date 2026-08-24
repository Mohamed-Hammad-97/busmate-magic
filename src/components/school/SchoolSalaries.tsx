import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DollarSign, Save } from 'lucide-react';
import { format } from 'date-fns';
import { useSchoolStaff, monthBounds, workingDaysInMonth } from './schoolStaff';

export function SchoolSalaries({ canEdit }: { canEdit: boolean }) {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [drafts, setDrafts] = useState<Record<string, { monthly_cost?: number; absence_override?: string }>>({});
  const [payOpen, setPayOpen] = useState(false);
  const [payPerson, setPayPerson] = useState<any>(null);
  const [payForm, setPayForm] = useState({ amount: 0, payment_date: format(new Date(), 'yyyy-MM-dd'), transfer_reference: '', notes: '' });

  const { start, end, startDate } = monthBounds(month);
  const monthKey = `${month}-01`;
  const workingDays = useMemo(() => workingDaysInMonth(startDate), [month]);

  const { data: staff = [] } = useSchoolStaff();

  const { data: attendance = [] } = useQuery({
    queryKey: ['salary-school-attendance', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from('school_attendance').select('*').gte('attendance_date', start).lte('attendance_date', end);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: advances = [] } = useQuery({
    queryKey: ['salary-advances', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_advances').select('*').gte('advance_date', start).lte('advance_date', end);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: coverage = [] } = useQuery({
    queryKey: ['salary-coverage', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_coverage').select('*').gte('coverage_date', start).lte('coverage_date', end);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: monthlySalaries = [] } = useQuery({
    queryKey: ['staff-monthly-salaries', monthKey],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_monthly_salaries').select('*').eq('month', monthKey);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: lastSalaries = [] } = useQuery({
    queryKey: ['staff-monthly-salaries-prev', monthKey],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_monthly_salaries').select('*').lt('month', monthKey).order('month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const workingDaySet = useMemo(() => new Set(workingDays), [workingDays]);

  const rows = useMemo(() => {
    return staff.map((p) => {
      const isDriver = p.type === 'driver';
      const matches = (r: any) => (isDriver ? r.driver_id === p.id : r.supervisor_id === p.id);

      const saved = monthlySalaries.find(matches);
      const previous = lastSalaries.find(matches);
      const draft = drafts[`${p.type}:${p.id}`] || {};
      const monthlyCost = draft.monthly_cost !== undefined
        ? draft.monthly_cost
        : Number(saved?.monthly_cost ?? previous?.monthly_cost ?? 0);

      const dailyRate = workingDays.length > 0 ? monthlyCost / workingDays.length : 0;

      const personAttendance = attendance.filter((a: any) => matches(a) && workingDaySet.has(a.attendance_date));
      const absentShifts = personAttendance.filter((a: any) => !a.is_present).length;
      const absentDays = absentShifts / 2;
      const autoAbsenceDeduction = absentDays * dailyRate;

      const overrideRaw = draft.absence_override !== undefined
        ? draft.absence_override
        : (saved?.absence_deduction_override === null || saved?.absence_deduction_override === undefined ? '' : String(saved.absence_deduction_override));
      const absenceDeduction = overrideRaw !== '' && !Number.isNaN(Number(overrideRaw)) ? Number(overrideRaw) : autoAbsenceDeduction;

      const extraDeductions = personAttendance.reduce((s: number, a: any) => s + Number(a.extra_deduction_amount || 0), 0);
      const advanceTotal = advances.filter(matches).reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
      const coverageDeducted = coverage
        .filter((c: any) => (isDriver ? c.covered_driver_id === p.id : c.covered_supervisor_id === p.id))
        .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const coverageEarned = coverage
        .filter((c: any) => (isDriver ? c.covering_driver_id === p.id : c.covering_supervisor_id === p.id))
        .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);

      const net = monthlyCost - advanceTotal - coverageDeducted + coverageEarned - absenceDeduction - extraDeductions;

      return { ...p, monthlyCost, dailyRate, absentDays, autoAbsenceDeduction, overrideRaw, absenceDeduction, extraDeductions, advanceTotal, coverageDeducted, coverageEarned, net, savedId: saved?.id };
    });
  }, [staff, monthlySalaries, lastSalaries, drafts, attendance, advances, coverage, workingDays, workingDaySet]);

  const saveRow = useMutation({
    mutationFn: async (row: any) => {
      const payload: any = {
        driver_id: row.type === 'driver' ? row.id : null,
        supervisor_id: row.type === 'supervisor' ? row.id : null,
        month: monthKey,
        monthly_cost: row.monthlyCost || 0,
        absence_deduction_override: row.overrideRaw === '' ? null : Number(row.overrideRaw),
        created_by: user?.id,
      };
      if (row.savedId) {
        const { error } = await supabase.from('staff_monthly_salaries').update(payload).eq('id', row.savedId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff_monthly_salaries').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-monthly-salaries'] }); setDrafts({}); toast.success(ar ? 'تم الحفظ' : 'Saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const savePayment = useMutation({
    mutationFn: async () => {
      const payload: any = {
        amount: payForm.amount,
        period_start: start,
        period_end: end,
        payment_date: payForm.payment_date,
        transfer_reference: payForm.transfer_reference || null,
        notes: payForm.notes || null,
        created_by: user?.id,
        driver_id: payPerson.type === 'driver' ? payPerson.id : null,
        supervisor_id: payPerson.type === 'supervisor' ? payPerson.id : null,
      };
      const { error } = await supabase.from('salary_payments').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { setPayOpen(false); toast.success(ar ? 'تم تسجيل الدفع' : 'Payment recorded'); },
    onError: (e: any) => toast.error(e.message),
  });

  const setDraft = (row: any, patch: any) => setDrafts((p) => ({ ...p, [`${row.type}:${row.id}`]: { ...(p[`${row.type}:${row.id}`] || {}), ...patch } }));

  const totalNet = rows.reduce((s, r) => s + r.net, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: ar ? 'أيام العمل بالشهر' : 'Working days', value: workingDays.length },
          { label: ar ? 'عدد الموظفين' : 'Staff count', value: rows.length },
          { label: ar ? 'إجمالي صافي المرتبات' : 'Total net salaries', value: Math.round(totalNet).toLocaleString() },
          { label: ar ? 'إجمالي السلف' : 'Total advances', value: Math.round(rows.reduce((s, r) => s + r.advanceTotal, 0)).toLocaleString() },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{ar ? 'الشهر' : 'Month'}</Label>
          <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setDrafts({}); }} dir="ltr" className="w-44" />
        </div>
        <p className="text-xs text-muted-foreground self-center">
          {ar ? 'الشهر يُحسب من الأحد إلى الخميس' : 'The month counts Sunday to Thursday only'} — {workingDays.length} {ar ? 'يوم' : 'days'}
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
          <h2 className="text-sm font-semibold">{ar ? 'مرتبات المدارس' : 'School salaries'}</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs uppercase">{ar ? 'الاسم' : 'Name'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'الصفة' : 'Type'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'تكلفة الشهر' : 'Monthly cost'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'اليومي' : 'Daily'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'أيام الغياب' : 'Absent days'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'خصم الغياب (تلقائي)' : 'Absence (auto)'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'خصم الغياب (يدوي)' : 'Absence (manual)'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'السلف' : 'Advances'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'تغطية (خصم)' : 'Coverage (-)'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'تغطية (إضافة)' : 'Coverage (+)'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'خصومات إضافية' : 'Extra deductions'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'الصافي' : 'Net'}</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.type}:${r.id}`}>
                  <TableCell className="text-sm font-medium">{r.full_name}</TableCell>
                  <TableCell><Badge variant={r.type === 'driver' ? 'outline' : 'secondary'} className="text-xs">{r.type === 'driver' ? (ar ? 'سائق' : 'Driver') : (ar ? 'مشرف' : 'Supervisor')}</Badge></TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input type="number" dir="ltr" className="h-8 w-28 text-xs" value={r.monthlyCost || ''} onChange={(e) => setDraft(r, { monthly_cost: Number(e.target.value) })} />
                    ) : <span className="text-sm font-mono">{r.monthlyCost.toLocaleString()}</span>}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{Math.round(r.dailyRate).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{r.absentDays}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{Math.round(r.autoAbsenceDeduction).toLocaleString()}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input type="number" dir="ltr" placeholder={ar ? 'تلقائي' : 'auto'} className="h-8 w-24 text-xs" value={r.overrideRaw} onChange={(e) => setDraft(r, { absence_override: e.target.value })} />
                    ) : <span className="text-sm font-mono">{r.overrideRaw || '-'}</span>}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-destructive">{Math.round(r.advanceTotal).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-mono text-destructive">{Math.round(r.coverageDeducted).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-mono text-success">{Math.round(r.coverageEarned).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-mono text-destructive">{Math.round(r.extraDeductions).toLocaleString()}</TableCell>
                  <TableCell className="text-sm font-bold font-mono">{Math.round(r.net).toLocaleString()}</TableCell>
                  {canEdit && (
                    <TableCell className="text-end whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => saveRow.mutate(r)}><Save className="h-3.5 w-3.5" />{ar ? 'حفظ' : 'Save'}</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setPayPerson(r); setPayForm({ amount: Math.round(r.net), payment_date: format(new Date(), 'yyyy-MM-dd'), transfer_reference: '', notes: '' }); setPayOpen(true); }}>{ar ? 'صرف' : 'Pay'}</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{ar ? 'تسجيل صرف مرتب' : 'Record salary payment'} — {payPerson?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{ar ? 'المبلغ' : 'Amount'}</Label>
                <Input type="number" dir="ltr" value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>{ar ? 'تاريخ الصرف' : 'Payment date'}</Label>
                <Input type="date" dir="ltr" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{ar ? 'مرجع التحويل' : 'Transfer reference'}</Label>
              <Input value={payForm.transfer_reference} onChange={(e) => setPayForm({ ...payForm, transfer_reference: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{ar ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => savePayment.mutate()} disabled={savePayment.isPending}>{ar ? 'حفظ' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
