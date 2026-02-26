import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  DollarSign, Upload, FileText, Save, Eye, Calendar, Loader2,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export function SalaryManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    period_start: '',
    period_end: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    transfer_reference: '',
    notes: '',
  });
  const [uploading, setUploading] = useState(false);

  const dateRange = useMemo(() => {
    const date = new Date(selectedDate);
    if (viewMode === 'daily') return { start: selectedDate, end: selectedDate };
    if (viewMode === 'weekly') return { start: format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd'), end: format(endOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd') };
    return { start: format(startOfMonth(date), 'yyyy-MM-dd'), end: format(endOfMonth(date), 'yyyy-MM-dd') };
  }, [selectedDate, viewMode]);

  const { data: attendance = [] } = useQuery({
    queryKey: ['salary-attendance', dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corporate_driver_attendance')
        .select(`
          *,
          company_line:company_lines(name, company:companies(name))
        `)
        .gte('attendance_date', dateRange.start)
        .lte('attendance_date', dateRange.end)
        .eq('is_present', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['salary-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('id, full_name, phone').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['salary-supervisors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supervisors').select('id, full_name, phone').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: salaryPayments = [] } = useQuery({
    queryKey: ['salary-payments', dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('*')
        .gte('period_start', dateRange.start)
        .lte('period_end', dateRange.end);
      if (error) throw error;
      return data;
    },
  });

  // Calculate salary per person
  const salaryData = useMemo(() => {
    const personMap = new Map<string, { name: string; type: string; totalShifts: number; totalSalary: number; personId: string }>();

    attendance.forEach((a: any) => {
      const key = a.driver_id || a.supervisor_id;
      const person = a.driver_id
        ? drivers.find((d: any) => d.id === a.driver_id)
        : supervisors.find((s: any) => s.id === a.supervisor_id);

      if (!person) return;

      if (!personMap.has(key)) {
        personMap.set(key, {
          name: person.full_name,
          type: a.driver_id ? 'driver' : 'supervisor',
          totalShifts: 0,
          totalSalary: 0,
          personId: key,
        });
      }

      const entry = personMap.get(key)!;
      entry.totalShifts += 1;
      entry.totalSalary += Number(a.shift_rate || 0);
    });

    return Array.from(personMap.values()).sort((a, b) => b.totalSalary - a.totalSalary);
  }, [attendance, drivers, supervisors]);

  const totalSalaries = salaryData.reduce((sum, d) => sum + d.totalSalary, 0);
  const totalPaid = salaryPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const savePaymentMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        amount: paymentForm.amount,
        period_start: paymentForm.period_start || dateRange.start,
        period_end: paymentForm.period_end || dateRange.end,
        payment_date: paymentForm.payment_date,
        transfer_reference: paymentForm.transfer_reference || null,
        notes: paymentForm.notes || null,
        created_by: user?.id,
      };

      if (selectedPerson.type === 'driver') payload.driver_id = selectedPerson.personId;
      else payload.supervisor_id = selectedPerson.personId;

      const { error } = await supabase.from('salary_payments').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-payments'] });
      toast.success('تم تسجيل الدفع');
      setPaymentDialogOpen(false);
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const handlePayPerson = (person: any) => {
    setSelectedPerson(person);
    setPaymentForm({
      amount: person.totalSalary,
      period_start: dateRange.start,
      period_end: dateRange.end,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      transfer_reference: '',
      notes: '',
    });
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
      toast.success('تم رفع المرجع');
    } catch {
      toast.error('خطأ في الرفع');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي المستحقات', value: `${totalSalaries.toLocaleString()} ج.م`, color: 'primary' },
          { label: 'المدفوع', value: `${totalPaid.toLocaleString()} ج.م`, color: 'success' },
          { label: 'المتبقي', value: `${(totalSalaries - totalPaid).toLocaleString()} ج.م`, color: 'warning' },
          { label: 'عدد الموظفين', value: salaryData.length, color: 'info' },
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
          <Label>الفترة</Label>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="daily" className="text-xs px-3">يومي</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs px-3">أسبوعي</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs px-3">شهري</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="space-y-2">
          <Label>التاريخ</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} dir="ltr" className="w-44" />
        </div>
        <div className="text-xs text-muted-foreground self-center">
          من {dateRange.start} إلى {dateRange.end}
        </div>
      </div>

      {/* Salary Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">الرواتب والمستحقات</h2>
            <p className="text-xs text-muted-foreground">{salaryData.length} شخص</p>
          </div>
        </div>

        {salaryData.length === 0 ? (
          <div className="p-16 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد بيانات حضور لهذه الفترة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الاسم</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">النوع</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">عدد الوردات</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">المستحق</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">المدفوع</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryData.map((person) => {
                  const paid = salaryPayments
                    .filter((p: any) => (person.type === 'driver' ? p.driver_id === person.personId : p.supervisor_id === person.personId))
                    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

                  return (
                    <TableRow key={person.personId} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {person.name[0]}
                          </div>
                          <span className="font-medium text-sm">{person.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={person.type === 'driver' ? 'outline' : 'secondary'} className="text-xs">
                          {person.type === 'driver' ? 'سائق' : 'مشرف'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{person.totalShifts}</TableCell>
                      <TableCell className="font-mono text-sm font-semibold">{person.totalSalary.toLocaleString()} ج.م</TableCell>
                      <TableCell>
                        {paid > 0 ? (
                          <span className="text-success font-mono text-sm">{paid.toLocaleString()} ج.م</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handlePayPerson(person)}>
                          <DollarSign className="h-3 w-3" /> تسجيل دفع
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
            <DialogTitle>تسجيل دفع - {selectedPerson?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>المبلغ *</Label>
              <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input type="date" value={paymentForm.period_start} onChange={(e) => setPaymentForm({ ...paymentForm, period_start: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input type="date" value={paymentForm.period_end} onChange={(e) => setPaymentForm({ ...paymentForm, period_end: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>تاريخ التحويل</Label>
              <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>مرجع التحويل</Label>
              <div className="flex items-center gap-2">
                <Input value={paymentForm.transfer_reference} onChange={(e) => setPaymentForm({ ...paymentForm, transfer_reference: e.target.value })} placeholder="رقم أو رابط المرجع" />
                <label className="cursor-pointer shrink-0">
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReferenceUpload(f); }} />
                  <div className="flex items-center gap-1 px-3 py-2 rounded-md border border-border text-xs hover:bg-muted">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    رفع
                  </div>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => {
              if (paymentForm.amount <= 0) { toast.error('يرجى إدخال المبلغ'); return; }
              savePaymentMutation.mutate();
            }} disabled={savePaymentMutation.isPending}>
              {savePaymentMutation.isPending ? 'جاري الحفظ...' : 'تسجيل الدفع'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
