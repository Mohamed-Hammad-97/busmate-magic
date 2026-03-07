import React, { useState, useMemo } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { DollarSign, Upload, Save, Loader2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface SalaryManagementProps {
  staffContext?: 'school' | 'corporate';
  companyId?: string;
}

export function SalaryManagement({ staffContext, companyId }: SalaryManagementProps = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, period_start: '', period_end: '', payment_date: format(new Date(), 'yyyy-MM-dd'), transfer_reference: '', notes: '' });
  const [uploading, setUploading] = useState(false);

  const dateRange = useMemo(() => {
    const date = new Date(selectedDate);
    if (viewMode === 'daily') return { start: selectedDate, end: selectedDate };
    if (viewMode === 'weekly') return { start: format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd'), end: format(endOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd') };
    return { start: format(startOfMonth(date), 'yyyy-MM-dd'), end: format(endOfMonth(date), 'yyyy-MM-dd') };
  }, [selectedDate, viewMode]);

  const { data: attendance = [] } = useQuery({
    queryKey: ['salary-attendance', dateRange.start, dateRange.end, companyId],
    queryFn: async () => {
      let query = supabase.from('corporate_driver_attendance').select(`*, company_line:company_lines(name, company_id, company:companies(name))`).gte('attendance_date', dateRange.start).lte('attendance_date', dateRange.end).eq('is_present', true);
      if (companyId) {
        const { data: lineIds } = await supabase.from('company_lines').select('id').eq('company_id', companyId);
        if (lineIds && lineIds.length > 0) { query = query.in('company_line_id', lineIds.map(l => l.id)); } else { return []; }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['salary-drivers', staffContext],
    queryFn: async () => {
      let query = supabase.from('drivers').select('id, full_name, phone, belongs_to').order('full_name');
      if (staffContext) query = query.in('belongs_to', [staffContext, 'both']);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['salary-supervisors', staffContext],
    queryFn: async () => {
      let query = supabase.from('supervisors').select('id, full_name, phone, belongs_to').order('full_name');
      if (staffContext) query = query.in('belongs_to', [staffContext, 'both']);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: salaryPayments = [] } = useQuery({
    queryKey: ['salary-payments', dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase.from('salary_payments').select('*').gte('period_start', dateRange.start).lte('period_end', dateRange.end);
      if (error) throw error;
      return data;
    },
  });

  const salaryData = useMemo(() => {
    const personMap = new Map<string, { name: string; type: string; totalShifts: number; totalSalary: number; totalExtraFees: number; personId: string }>();
    attendance.forEach((a: any) => {
      const key = a.driver_id || a.supervisor_id;
      const person = a.driver_id ? drivers.find((d: any) => d.id === a.driver_id) : supervisors.find((s: any) => s.id === a.supervisor_id);
      if (!person) return;
      if (!personMap.has(key)) { personMap.set(key, { name: person.full_name, type: a.driver_id ? 'driver' : 'supervisor', totalShifts: 0, totalSalary: 0, totalExtraFees: 0, personId: key }); }
      const entry = personMap.get(key)!;
      entry.totalShifts += 1;
      entry.totalSalary += Number(a.shift_rate || 0);
      entry.totalExtraFees += Number(a.extra_fee_amount || 0);
    });
    return Array.from(personMap.values()).sort((a, b) => (b.totalSalary + b.totalExtraFees) - (a.totalSalary + a.totalExtraFees));
  }, [attendance, drivers, supervisors]);

  const totalSalaries = salaryData.reduce((sum, d) => sum + d.totalSalary + d.totalExtraFees, 0);
  const totalPaid = salaryPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const savePaymentMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        amount: paymentForm.amount, period_start: paymentForm.period_start || dateRange.start, period_end: paymentForm.period_end || dateRange.end,
        payment_date: paymentForm.payment_date, transfer_reference: paymentForm.transfer_reference || null, notes: paymentForm.notes || null, created_by: user?.id,
      };
      if (selectedPerson.type === 'driver') payload.driver_id = selectedPerson.personId;
      else payload.supervisor_id = selectedPerson.personId;
      const { error } = await supabase.from('salary_payments').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salary-payments'] }); toast.success(t('corporateMgmt.paymentRecorded')); setPaymentDialogOpen(false); },
    onError: () => toast.error(t('corporateMgmt.error')),
  });

  const handlePayPerson = (person: any) => {
    setSelectedPerson(person);
    setPaymentForm({ amount: person.totalSalary + person.totalExtraFees, period_start: dateRange.start, period_end: dateRange.end, payment_date: format(new Date(), 'yyyy-MM-dd'), transfer_reference: '', notes: '' });
    setPaymentDialogOpen(true);
  };

  const handleReferenceUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `salary-references/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('staff-documents').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('staff-documents').getPublicUrl(path);
      setPaymentForm(prev => ({ ...prev, transfer_reference: publicUrl }));
      toast.success(t('corporateMgmt.fileUploaded'));
    } catch { toast.error(t('corporateMgmt.fileUploadError')); } finally { setUploading(false); }
  };

  const cur = t('corporateMgmt.currency');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('corporateMgmt.totalDue'), value: `${totalSalaries.toLocaleString()} ${cur}` },
          { label: t('corporateMgmt.paidAmount'), value: `${totalPaid.toLocaleString()} ${cur}` },
          { label: t('corporateMgmt.remaining'), value: `${(totalSalaries - totalPaid).toLocaleString()} ${cur}` },
          { label: t('corporateMgmt.staffCount'), value: salaryData.length },
        ].map((stat, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{t('corporateMgmt.period')}</Label>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="daily" className="text-xs px-3">{t('corporateMgmt.daily')}</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs px-3">{t('corporateMgmt.weekly')}</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs px-3">{t('corporateMgmt.monthly')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="space-y-2">
          <Label>{t('corporateMgmt.dateLabel')}</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} dir="ltr" className="w-44" />
        </div>
        <div className="text-xs text-muted-foreground self-center">
          {t('corporateMgmt.fromDate')} {dateRange.start} {t('corporateMgmt.toDate')} {dateRange.end}
        </div>
      </div>

      {/* Salary Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('corporateMgmt.salariesTitle')}</h2>
            <p className="text-xs text-muted-foreground">{salaryData.length} {t('corporateMgmt.persons')}</p>
          </div>
        </div>

        {salaryData.length === 0 ? (
          <div className="p-16 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('corporateMgmt.noAttendanceData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.name')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.type')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.shiftWages')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.extra')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.totalLabel')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.paid')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryData.map((person) => {
                  const paid = salaryPayments.filter((p: any) => (person.type === 'driver' ? p.driver_id === person.personId : p.supervisor_id === person.personId)).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                  return (
                    <TableRow key={person.personId} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{person.name[0]}</div>
                          <span className="font-medium text-sm">{person.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={person.type === 'driver' ? 'outline' : 'secondary'} className="text-xs">
                          {person.type === 'driver' ? t('attendance.driver') : t('attendance.supervisor')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{person.totalSalary.toLocaleString()} {cur}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {person.totalExtraFees > 0 ? <span className="text-primary">{person.totalExtraFees.toLocaleString()} {cur}</span> : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold">{(person.totalSalary + person.totalExtraFees).toLocaleString()} {cur}</TableCell>
                      <TableCell>
                        {paid > 0 ? <span className="text-success font-mono text-sm">{paid.toLocaleString()} {cur}</span> : <span className="text-muted-foreground text-sm">-</span>}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handlePayPerson(person)}>
                          <DollarSign className="h-3 w-3" /> {t('corporateMgmt.recordPayment')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('corporateMgmt.paymentFor')} - {selectedPerson?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('corporateMgmt.amount')} *</Label>
              <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('corporateMgmt.fromDateLabel')}</Label>
                <Input type="date" value={paymentForm.period_start} onChange={(e) => setPaymentForm({ ...paymentForm, period_start: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t('corporateMgmt.toDateLabel')}</Label>
                <Input type="date" value={paymentForm.period_end} onChange={(e) => setPaymentForm({ ...paymentForm, period_end: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('corporateMgmt.transferDate')}</Label>
              <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t('corporateMgmt.transferReference')}</Label>
              <div className="flex items-center gap-2">
                <Input value={paymentForm.transfer_reference} onChange={(e) => setPaymentForm({ ...paymentForm, transfer_reference: e.target.value })} placeholder={t('corporateMgmt.refPlaceholder')} />
                <label className="cursor-pointer shrink-0">
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReferenceUpload(f); }} />
                  <div className="flex items-center gap-1 px-3 py-2 rounded-md border border-border text-xs hover:bg-muted">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {t('corporateMgmt.upload')}
                  </div>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('corporateMgmt.notes')}</Label>
              <Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => {
              if (paymentForm.amount <= 0) { toast.error(t('corporateMgmt.enterAmount')); return; }
              savePaymentMutation.mutate();
            }} disabled={savePaymentMutation.isPending}>
              {savePaymentMutation.isPending ? t('corporateMgmt.recordingPayment') : t('corporateMgmt.recordPayment')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
