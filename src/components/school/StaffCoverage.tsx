import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Plus, Pencil, Trash2, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { useSchoolStaff, monthBounds } from './schoolStaff';

export function StaffCoverage({ canEdit }: { canEdit: boolean }) {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ covered: '', covering: '', route_id: 'none', coverage_date: format(new Date(), 'yyyy-MM-dd'), amount: 0, notes: '' });

  const { data: staff = [] } = useSchoolStaff();
  const { start, end } = monthBounds(month);

  const { data: routes = [] } = useQuery({
    queryKey: ['coverage-routes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('routes').select('id, name, route_number').eq('is_active', true).order('route_number');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ['staff-coverage', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_coverage').select('*, routes(name, route_number)').gte('coverage_date', start).lte('coverage_date', end).order('coverage_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const nameOf = (driverId: string | null, supervisorId: string | null) =>
    staff.find((p) => (driverId ? p.type === 'driver' && p.id === driverId : p.type === 'supervisor' && p.id === supervisorId))?.full_name || '-';

  const save = useMutation({
    mutationFn: async () => {
      const [cType, cId] = form.covered.split(':');
      const [gType, gId] = form.covering.split(':');
      if (!cId || !gId) throw new Error(ar ? 'اختر الموظفين' : 'Select both people');
      const payload: any = {
        coverage_date: form.coverage_date,
        route_id: form.route_id === 'none' ? null : form.route_id,
        covered_driver_id: cType === 'driver' ? cId : null,
        covered_supervisor_id: cType === 'supervisor' ? cId : null,
        covering_driver_id: gType === 'driver' ? gId : null,
        covering_supervisor_id: gType === 'supervisor' ? gId : null,
        amount: form.amount,
        notes: form.notes || null,
        created_by: user?.id,
      };
      if (editing) {
        const { error } = await supabase.from('staff_coverage').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff_coverage').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-coverage'] }); setOpen(false); setEditing(null); toast.success(ar ? 'تم الحفظ' : 'Saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('staff_coverage').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-coverage'] }); toast.success(ar ? 'تم الحذف' : 'Deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ covered: '', covering: '', route_id: 'none', coverage_date: format(new Date(), 'yyyy-MM-dd'), amount: 0, notes: '' }); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      covered: row.covered_driver_id ? `driver:${row.covered_driver_id}` : `supervisor:${row.covered_supervisor_id}`,
      covering: row.covering_driver_id ? `driver:${row.covering_driver_id}` : `supervisor:${row.covering_supervisor_id}`,
      route_id: row.route_id || 'none',
      coverage_date: row.coverage_date,
      amount: Number(row.amount),
      notes: row.notes || '',
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{ar ? 'الشهر' : 'Month'}</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} dir="ltr" className="w-44" />
        </div>
        {canEdit && <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />{ar ? 'إضافة تغطية' : 'Add coverage'}</Button>}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold">{ar ? 'التغطية' : 'Coverage'}</h2>
            <p className="text-xs text-muted-foreground">{ar ? 'المبلغ يُخصم من الغائب ويُضاف لمن قام بالتغطية' : 'Amount is deducted from the covered person and added to the covering person'}</p>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="p-16 text-center text-sm text-muted-foreground">{ar ? 'لا توجد تغطيات في هذا الشهر' : 'No coverage records this month'}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs uppercase">{ar ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'الغائب' : 'Covered'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'قام بالتغطية' : 'Covering'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'الخط' : 'Route'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'ملاحظات' : 'Notes'}</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm" dir="ltr">{r.coverage_date}</TableCell>
                  <TableCell className="text-sm">{nameOf(r.covered_driver_id, r.covered_supervisor_id)}</TableCell>
                  <TableCell className="text-sm font-medium flex items-center gap-2"><ArrowLeftRight className="h-3 w-3 text-muted-foreground" />{nameOf(r.covering_driver_id, r.covering_supervisor_id)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.routes ? `${r.routes.route_number ? `#${r.routes.route_number} ` : ''}${r.routes.name}` : '-'}</TableCell>
                  <TableCell className="text-sm font-mono">{Number(r.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.notes || '-'}</TableCell>
                  {canEdit && (
                    <TableCell className="text-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? (ar ? 'تعديل تغطية' : 'Edit coverage') : (ar ? 'إضافة تغطية' : 'Add coverage')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{ar ? 'الموظف الغائب (يُخصم منه)' : 'Covered person (deducted)'}</Label>
              <Select value={form.covered} onValueChange={(v) => setForm({ ...form, covered: v })}>
                <SelectTrigger><SelectValue placeholder={ar ? 'اختر' : 'Select'} /></SelectTrigger>
                <SelectContent>{staff.map((p) => <SelectItem key={`c-${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>{p.full_name} — {p.type === 'driver' ? (ar ? 'سائق' : 'Driver') : (ar ? 'مشرف' : 'Supervisor')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{ar ? 'من قام بالتغطية (يُضاف له)' : 'Covering person (added)'}</Label>
              <Select value={form.covering} onValueChange={(v) => setForm({ ...form, covering: v })}>
                <SelectTrigger><SelectValue placeholder={ar ? 'اختر' : 'Select'} /></SelectTrigger>
                <SelectContent>{staff.map((p) => <SelectItem key={`g-${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>{p.full_name} — {p.type === 'driver' ? (ar ? 'سائق' : 'Driver') : (ar ? 'مشرف' : 'Supervisor')}</SelectItem>)}</SelectContent>
            </Select>
            </div>
            <div className="space-y-2">
              <Label>{ar ? 'الخط' : 'Route'}</Label>
              <Select value={form.route_id} onValueChange={(v) => setForm({ ...form, route_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{ar ? 'بدون' : 'None'}</SelectItem>
                  {routes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.route_number ? `#${r.route_number} - ` : ''}{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{ar ? 'التاريخ' : 'Date'}</Label>
                <Input type="date" dir="ltr" value={form.coverage_date} onChange={(e) => setForm({ ...form, coverage_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{ar ? 'المبلغ' : 'Amount'}</Label>
                <Input type="number" dir="ltr" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{ar ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>{ar ? 'حفظ' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
