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
import { toast } from 'sonner';
import {
  FileText, Plus, Download, DollarSign, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExtraItem {
  name: string;
  amount: number;
}

export function CompanyInvoices() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [invoiceForm, setInvoiceForm] = useState({
    period_start: format(new Date(), 'yyyy-MM-01'),
    period_end: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);

  const { data: companies = [] } = useQuery({
    queryKey: ['invoice-companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['company-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_invoices')
        .select('*, company:companies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: companyLines = [] } = useQuery({
    queryKey: ['invoice-lines', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const { data, error } = await supabase
        .from('company_lines')
        .select('id, name, number_of_shifts, price_per_shift')
        .eq('company_id', selectedCompanyId)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompanyId,
  });

  const { data: attendanceForInvoice = [] } = useQuery({
    queryKey: ['invoice-attendance', selectedCompanyId, invoiceForm.period_start, invoiceForm.period_end],
    queryFn: async () => {
      if (!selectedCompanyId || !companyLines.length) return [];
      const lineIds = companyLines.map((l: any) => l.id);
      const { data, error } = await supabase
        .from('corporate_driver_attendance')
        .select('company_line_id, shift_number, shift_rate')
        .in('company_line_id', lineIds)
        .gte('attendance_date', invoiceForm.period_start)
        .lte('attendance_date', invoiceForm.period_end)
        .eq('is_present', true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompanyId && companyLines.length > 0,
  });

  const lineItems = useMemo(() => {
    return companyLines.map((line: any) => {
      const shifts = attendanceForInvoice.filter((a: any) => a.company_line_id === line.id);
      const uniqueShifts = new Set(shifts.map((s: any) => `${s.company_line_id}-${s.shift_number}`)).size;
      const total = uniqueShifts * Number(line.price_per_shift);
      return {
        line_name: line.name,
        shifts_count: uniqueShifts,
        price_per_shift: Number(line.price_per_shift),
        total,
      };
    });
  }, [companyLines, attendanceForInvoice]);

  const extraItemsTotal = extraItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const invoiceTotal = lineItems.reduce((sum, item) => sum + item.total, 0) + extraItemsTotal;

  const addExtraItem = () => {
    setExtraItems(prev => [...prev, { name: '', amount: 0 }]);
  };

  const updateExtraItem = (index: number, field: keyof ExtraItem, value: string | number) => {
    setExtraItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeExtraItem = (index: number) => {
    setExtraItems(prev => prev.filter((_, i) => i !== index));
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const company = companies.find((c: any) => c.id === selectedCompanyId);
      const invoiceNumber = `INV-${company?.name?.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

      // Combine line items and extra items into one array
      const allItems = [
        ...lineItems,
        ...extraItems.filter(e => e.name && e.amount).map(e => ({
          line_name: e.name,
          shifts_count: 0,
          price_per_shift: 0,
          total: e.amount,
          is_extra: true,
        })),
      ];

      const { error } = await supabase.from('company_invoices').insert({
        company_id: selectedCompanyId,
        invoice_number: invoiceNumber,
        period_start: invoiceForm.period_start,
        period_end: invoiceForm.period_end,
        total_amount: invoiceTotal,
        line_items: allItems,
        status: 'issued',
        issued_date: format(new Date(), 'yyyy-MM-dd'),
        notes: invoiceForm.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invoices'] });
      toast.success('تم إنشاء الفاتورة');
      setInvoiceDialogOpen(false);
      setExtraItems([]);
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const downloadInvoicePDF = (invoice: any) => {
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(20);
    doc.text('INVOICE', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 14, 35);
    doc.text(`Company: ${invoice.company?.name || ''}`, 14, 42);
    doc.text(`Period: ${invoice.period_start} - ${invoice.period_end}`, 14, 49);
    doc.text(`Issued: ${invoice.issued_date || ''}`, 14, 56);

    const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    autoTable(doc, {
      startY: 65,
      head: [['Item', 'Shifts', 'Rate/Shift', 'Total']],
      body: items.map((item: any) => [
        item.line_name,
        item.is_extra ? '-' : item.shifts_count,
        item.is_extra ? '-' : `${item.price_per_shift} EGP`,
        `${item.total} EGP`,
      ]),
      foot: [['', '', 'Total', `${invoice.total_amount} EGP`]],
    });

    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const statusLabels: Record<string, { label: string; className: string }> = {
    draft: { label: 'مسودة', className: 'bg-muted/50 text-muted-foreground border-border/50' },
    issued: { label: 'صادرة', className: 'bg-info/10 text-info border-info/20' },
    paid: { label: 'مدفوعة', className: 'bg-success/10 text-success border-success/20' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Button className="gap-2" onClick={() => { setSelectedCompanyId(''); setExtraItems([]); setInvoiceDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          إنشاء فاتورة
        </Button>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">فواتير الشركات</h2>
            <p className="text-xs text-muted-foreground">{invoices.length} فاتورة</p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد فواتير</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الشركة</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الفترة</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">المبلغ</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الحالة</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice: any) => {
                  const status = statusLabels[invoice.status] || statusLabels.draft;
                  return (
                    <TableRow key={invoice.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-sm">{invoice.company?.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{invoice.period_start} → {invoice.period_end}</TableCell>
                      <TableCell className="font-mono text-sm font-semibold">{Number(invoice.total_amount).toLocaleString()} ج.م</TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${status.className}`}>
                          {status.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => downloadInvoicePDF(invoice)}>
                          <Download className="h-4 w-4" />
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

      {/* Create Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إنشاء فاتورة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الشركة *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger><SelectValue placeholder="اختر شركة..." /></SelectTrigger>
                <SelectContent>
                  {companies.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input type="date" value={invoiceForm.period_start} onChange={(e) => setInvoiceForm({ ...invoiceForm, period_start: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input type="date" value={invoiceForm.period_end} onChange={(e) => setInvoiceForm({ ...invoiceForm, period_end: e.target.value })} dir="ltr" />
              </div>
            </div>

            {/* Line Items Preview */}
            {selectedCompanyId && lineItems.length > 0 && (
              <div className="space-y-2">
                <Label>بنود الخطوط</Label>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs text-right">الخط</TableHead>
                        <TableHead className="text-xs text-right">الوردات</TableHead>
                        <TableHead className="text-xs text-right">السعر</TableHead>
                        <TableHead className="text-xs text-right">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.line_name}</TableCell>
                          <TableCell className="text-sm font-mono">{item.shifts_count}</TableCell>
                          <TableCell className="text-sm font-mono">{item.price_per_shift}</TableCell>
                          <TableCell className="text-sm font-mono font-semibold">{item.total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Extra Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>بنود إضافية</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={addExtraItem}>
                  <Plus className="h-3 w-3" /> إضافة بند
                </Button>
              </div>
              {extraItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/20">
                  <Input
                    className="flex-1 h-8 text-xs"
                    placeholder="اسم البند..."
                    value={item.name}
                    onChange={(e) => updateExtraItem(i, 'name', e.target.value)}
                  />
                  <Input
                    type="number"
                    className="w-28 h-8 text-xs"
                    placeholder="المبلغ"
                    dir="ltr"
                    value={item.amount || ''}
                    onChange={(e) => updateExtraItem(i, 'amount', Number(e.target.value))}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeExtraItem(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            {selectedCompanyId && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">مجموع الخطوط</span>
                  <span className="font-mono">{lineItems.reduce((s, i) => s + i.total, 0).toLocaleString()} ج.م</span>
                </div>
                {extraItemsTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">بنود إضافية</span>
                    <span className="font-mono">{extraItemsTotal.toLocaleString()} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-primary/20 pt-1.5">
                  <span>الإجمالي</span>
                  <span className="font-mono">{invoiceTotal.toLocaleString()} ج.م</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />
            </div>

            <Button className="w-full" onClick={() => {
              if (!selectedCompanyId) { toast.error('اختر شركة'); return; }
              createInvoiceMutation.mutate();
            }} disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending ? 'جاري الإنشاء...' : `إنشاء فاتورة (${invoiceTotal.toLocaleString()} ج.م)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}