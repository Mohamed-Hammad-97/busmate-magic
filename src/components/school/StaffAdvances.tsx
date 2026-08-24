import React, { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useSchoolStaff, monthBounds } from './schoolStaff';

export function StaffAdvances({ canEdit }: { canEdit: boolean }) {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ person: '', advance_date: format(new Date(), 'yyyy-MM-dd'), amount: 0, notes: '' });

  const { data: staff = [] } = useSchoolStaff();
  const { start, end } = monthBounds(month);

  const { data: advances = [] } = useQuery({
    queryKey: ['staff-advances', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_advances').select('*').gte('advance_date', start).lte('advance_date', end).order('advance_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const nameOf = (row: any) => staff.find((p) => (row.driver_id ? p.type === 'driver' && p.id === row.driver_id : p.type === 'supervisor' && p.id === row.supervisor_id))?.full_name || '-';

  const save = useMutation({
    mutationFn: async () => {
      const [type, id] = form.person.split(':');
      if (!id) throw new Error(ar ? 'اختر الموظف' : 'Select a person');
      const payload: any = {
        driver_id: type === 'driver' ? id : null,
        supervisor_id: type === 'supervisor' ? id : null,
        advance_date: form.advance_date,
        amount: form.amount,
        notes: form.notes || null,
        created_by: user?.id,
      };
      if (editing) {
        const { error } = await supabase.from('staff_advances').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff_advances').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-advances'] }); setOpen(false); setEditing(null); toast.success(ar ? 'تم الحفظ' : 'Saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('staff_advances').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-advances'] }); toast.success(ar ? 'تم الحذف' : 'Deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ person: '', advance_date: format(new Date(), 'yyyy-MM-dd'), amount: 0, notes: '' }); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ person: row.driver_id ? `driver:${row.driver_id}` : `supervisor:${row.supervisor_id}`, advance_date: row.advance_date, amount: Number(row.amount), notes: row.notes || '' });
    setOpen(true);
  };

  const total = advances.reduce((s: number, a: any) => s + Number(a.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{ar ? 'الشهر' : 'Month'}</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} dir="ltr" className="w-44" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card px-4 py-2">
          <p className="text-[11px] text-muted-foreground">{ar ? 'إجمالي السلف' : 'Total advances'}</p>
          <p className="text-lg font-bold">{total.toLocaleString()}</p>
        </div>
        {canEdit && <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />{ar ? 'إضافة سلفة' : 'Add advance'}</Button>}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><Wallet className="h-4 w-4 text-primary" /></div>
          <h2 className="text-sm font-semibold">{ar ? 'السلف' : 'Advances'}</h2>
        </div>
        {advances.length === 0 ? (
          <div className="p-16 text-center text-sm text-muted-foreground">{ar ? 'لا توجد سلف في هذا الشهر' : 'No advances this month'}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs uppercase">{ar ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'الاسم' : 'Name'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'الصفة' : 'Type'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead className="text-xs uppercase">{ar ? 'ملاحظات' : 'Notes'}</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {advances.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm" dir="ltr">{a.advance_date}</TableCell>
                  <TableCell className="text-sm font-medium">{nameOf(a)}</TableCell>
                  <TableCell><Badge variant={a.driver_id ? 'outline' : 'secondary'} className="text-xs">{a.driver_id ? (ar ? 'سائق' : 'Driver') : (ar ? 'مشرف' : 'Supervisor')}</Badge></TableCell>
                  <TableCell className="text-sm font-mono">{Number(a.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.notes || '-'}</TableCell>
                  {canEdit && (
                    <TableCell className="text-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? (ar ? 'تعديل سلفة' : 'Edit advance') : (ar ? 'إضافة سلفة' : 'Add advance')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{ar ? 'الموظف' : 'Person'}</Label>
              <Select value={form.person} onValueChange={(v) => setForm({ ...form, person: v })}>
                <SelectTrigger><SelectValue placeholder={ar ? 'اختر' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  {staff.map((p) => <SelectItem key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>{p.full_name} — {p.type === 'driver' ? (ar ? 'سائق' : 'Driver') : (ar ? 'مشرف' : 'Supervisor')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{ar ? 'التاريخ' : 'Date'}</Label>
                <Input type="date" dir="ltr" value={form.advance_date} onChange={(e) => setForm({ ...form, advance_date: e.target.value })} />
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
