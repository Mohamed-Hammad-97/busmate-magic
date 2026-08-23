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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Plus, Download, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExtraItem { name: string; amount: number; }

interface CompanyInvoicesProps { companyId?: string; }

export function CompanyInvoices({ companyId: fixedCompanyId }: CompanyInvoicesProps = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [invoiceForm, setInvoiceForm] = useState({ period_start: format(new Date(), 'yyyy-MM-01'), period_end: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);

  const effectiveCompanyId = fixedCompanyId || selectedCompanyId;
  const cur = t('corporateMgmt.currency');

  const { data: companies = [] } = useQuery({
    queryKey: ['invoice-companies'],
    queryFn: async () => { const { data, error } = await supabase.from('companies').select('id, name').eq('is_active', true).order('name'); if (error) throw error; return data; },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['company-invoices', fixedCompanyId],
    queryFn: async () => {
      let query = supabase.from('company_invoices').select('*, company:companies(name)').order('created_at', { ascending: false });
      if (fixedCompanyId) query = query.eq('company_id', fixedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: companyLines = [] } = useQuery({
    queryKey: ['invoice-lines', effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) return [];
      const { data, error } = await supabase.from('company_lines').select('id, name, number_of_shifts, price_per_shift').eq('company_id', effectiveCompanyId).eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveCompanyId,
  });

  const { data: attendanceForInvoice = [] } = useQuery({
    queryKey: ['invoice-attendance', effectiveCompanyId, invoiceForm.period_start, invoiceForm.period_end],
    queryFn: async () => {
      if (!effectiveCompanyId || !companyLines.length) return [];
      const lineIds = companyLines.map((l: any) => l.id);
      const { data, error } = await supabase.from('corporate_driver_attendance').select('company_line_id, attendance_date, shift_number, shift_rate, extra_fee_amount, extra_fee_reason').in('company_line_id', lineIds).gte('attendance_date', invoiceForm.period_start).lte('attendance_date', invoiceForm.period_end).eq('is_present', true);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveCompanyId && companyLines.length > 0,
  });

  // Each attendance record = one shift on a specific day. Dedupe only exact
  // duplicates (same line + date + shift number), never across days.
  const lineItems = useMemo(() => {
    return companyLines.map((line: any) => {
      const seen = new Set<string>();
      let shiftsCount = 0;
      let total = 0;
      attendanceForInvoice
        .filter((a: any) => a.company_line_id === line.id)
        .forEach((a: any) => {
          const key = `${a.company_line_id}-${a.attendance_date}-${a.shift_number}`;
          if (seen.has(key)) return;
          seen.add(key);
          shiftsCount += 1;
          total += Number(a.shift_rate ?? line.price_per_shift ?? 0);
        });
      const avgRate = shiftsCount > 0 ? Math.round((total / shiftsCount) * 100) / 100 : Number(line.price_per_shift ?? 0);
      return { line_name: line.name, shifts_count: shiftsCount, price_per_shift: avgRate, total };
    }).filter((item: any) => item.shifts_count > 0);
  }, [companyLines, attendanceForInvoice]);

  // Extra fees recorded on attendance rows, grouped per line
  const attendanceExtras = useMemo(() => {
    const byLine = new Map<string, number>();
    attendanceForInvoice.forEach((a: any) => {
      const amount = Number(a.extra_fee_amount || 0);
      if (!amount) return;
      byLine.set(a.company_line_id, (byLine.get(a.company_line_id) || 0) + amount);
    });
    return Array.from(byLine.entries()).map(([lineId, amount]) => {
      const line = companyLines.find((l: any) => l.id === lineId);
      return { line_name: `${t('corporateMgmt.extraItemsLabel')} - ${line?.name || ''}`, shifts_count: 0, price_per_shift: 0, total: amount, is_extra: true };
    });
  }, [attendanceForInvoice, companyLines, t]);

  const totalShifts = lineItems.reduce((s: number, i: any) => s + i.shifts_count, 0);
  const linesTotal = lineItems.reduce((s: number, i: any) => s + i.total, 0);
  const attendanceExtrasTotal = attendanceExtras.reduce((s: number, i: any) => s + i.total, 0);
  const extraItemsTotal = extraItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const invoiceTotal = linesTotal + attendanceExtrasTotal + extraItemsTotal;
  const periodDays = (() => {
    const start = new Date(invoiceForm.period_start).getTime();
    const end = new Date(invoiceForm.period_end).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return 0;
    return Math.round((end - start) / 86400000) + 1;
  })();

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const company = companies.find((c: any) => c.id === effectiveCompanyId);
      const invoiceNumber = `INV-${company?.name?.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const allItems = [...lineItems, ...attendanceExtras, ...extraItems.filter(e => e.name && e.amount).map(e => ({ line_name: e.name, shifts_count: 0, price_per_shift: 0, total: e.amount, is_extra: true }))];
      const { error } = await supabase.from('company_invoices').insert({
        company_id: effectiveCompanyId, invoice_number: invoiceNumber, period_start: invoiceForm.period_start, period_end: invoiceForm.period_end,
        total_amount: invoiceTotal, line_items: allItems, status: 'issued', issued_date: format(new Date(), 'yyyy-MM-dd'), notes: invoiceForm.notes || null, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['company-invoices'] }); toast.success(t('corporateMgmt.invoiceCreated')); setInvoiceDialogOpen(false); setExtraItems([]); },
    onError: () => toast.error(t('corporateMgmt.error')),
  });

  const downloadInvoicePDF = (invoice: any) => {
    const doc = new jsPDF();
    doc.setFont('helvetica'); doc.setFontSize(20);
    doc.text('INVOICE', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 14, 35);
    doc.text(`Company: ${invoice.company?.name || ''}`, 14, 42);
    doc.text(`Period: ${invoice.period_start} - ${invoice.period_end}`, 14, 49);
    doc.text(`Issued: ${invoice.issued_date || ''}`, 14, 56);
    const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    autoTable(doc, {
      startY: 65, head: [['Item', 'Shifts', 'Rate/Shift', 'Total']],
      body: items.map((item: any) => [item.line_name, item.is_extra ? '-' : item.shifts_count, item.is_extra ? '-' : `${item.price_per_shift} EGP`, `${item.total} EGP`]),
      foot: [['', '', 'Total', `${invoice.total_amount} EGP`]],
    });
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const statusLabels: Record<string, { label: string; className: string }> = {
    draft: { label: t('corporateMgmt.draft'), className: 'bg-muted/50 text-muted-foreground border-border/50' },
    issued: { label: t('corporateMgmt.issued'), className: 'bg-info/10 text-info border-info/20' },
    paid: { label: t('payments.paid'), className: 'bg-success/10 text-success border-success/20' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Button className="gap-2" onClick={() => { if (!fixedCompanyId) setSelectedCompanyId(''); setExtraItems([]); setInvoiceDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> {t('corporateMgmt.createInvoice')}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('corporateMgmt.companyInvoices')}</h2>
            <p className="text-xs text-muted-foreground">{invoices.length} {t('corporateMgmt.invoice')}</p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-16 text-center"><FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">{t('corporateMgmt.noInvoices')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.invoiceNumber')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.company')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.periodLabel')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.amountLabel')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.statusLabel')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.actions')}</TableHead>
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
                      <TableCell className="font-mono text-sm font-semibold">{Number(invoice.total_amount).toLocaleString()} {cur}</TableCell>
                      <TableCell><div className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${status.className}`}>{status.label}</div></TableCell>
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
          <DialogHeader><DialogTitle>{t('corporateMgmt.createNewInvoice')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!fixedCompanyId && (
              <div className="space-y-2">
                <Label>{t('corporateMgmt.company')} *</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger><SelectValue placeholder={t('corporateMgmt.selectCompany')} /></SelectTrigger>
                  <SelectContent>{companies.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t('corporateMgmt.fromDateLabel')}</Label><Input type="date" value={invoiceForm.period_start} onChange={(e) => setInvoiceForm({ ...invoiceForm, period_start: e.target.value })} dir="ltr" /></div>
              <div className="space-y-2"><Label>{t('corporateMgmt.toDateLabel')}</Label><Input type="date" value={invoiceForm.period_end} onChange={(e) => setInvoiceForm({ ...invoiceForm, period_end: e.target.value })} dir="ltr" /></div>
            </div>
            {effectiveCompanyId && lineItems.length > 0 && (
              <div className="space-y-2">
                <Label>{t('corporateMgmt.lineItems')}</Label>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs text-right">{t('corporateMgmt.lineLabel')}</TableHead>
                        <TableHead className="text-xs text-right">{t('corporateMgmt.shifts')}</TableHead>
                        <TableHead className="text-xs text-right">{t('corporateMgmt.price')}</TableHead>
                        <TableHead className="text-xs text-right">{t('corporateMgmt.totalLabel')}</TableHead>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('corporateMgmt.extraItems')}</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setExtraItems(prev => [...prev, { name: '', amount: 0 }])}>
                  <Plus className="h-3 w-3" /> {t('corporateMgmt.addItem')}
                </Button>
              </div>
              {extraItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/20">
                  <Input className="flex-1 h-8 text-xs" placeholder={t('corporateMgmt.itemName')} value={item.name} onChange={(e) => setExtraItems(prev => prev.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it))} />
                  <Input type="number" className="w-28 h-8 text-xs" placeholder={t('corporateMgmt.amountLabel')} dir="ltr" value={item.amount || ''} onChange={(e) => setExtraItems(prev => prev.map((it, idx) => idx === i ? { ...it, amount: Number(e.target.value) } : it))} />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setExtraItems(prev => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {effectiveCompanyId && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{periodDays} {t('corporateMgmt.days', 'يوم')}</span><span className="font-mono">{totalShifts} {t('corporateMgmt.shifts')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('corporateMgmt.linesTotal')}</span><span className="font-mono">{linesTotal.toLocaleString()} {cur}</span></div>
                {attendanceExtrasTotal > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('corporateMgmt.extraItemsLabel')}</span><span className="font-mono">{attendanceExtrasTotal.toLocaleString()} {cur}</span></div>}
                {extraItemsTotal > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('corporateMgmt.extraItemsLabel')}</span><span className="font-mono">{extraItemsTotal.toLocaleString()} {cur}</span></div>}
                <div className="flex justify-between text-sm font-bold border-t border-primary/20 pt-1.5"><span>{t('corporateMgmt.totalLabel')}</span><span className="font-mono">{invoiceTotal.toLocaleString()} {cur}</span></div>
              </div>
            )}
            <div className="space-y-2"><Label>{t('corporateMgmt.notes')}</Label><Textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={() => {
              if (!effectiveCompanyId) { toast.error(t('corporateMgmt.selectCompany')); return; }
              createInvoiceMutation.mutate();
            }} disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending ? t('corporateMgmt.creatingInvoice') : `${t('corporateMgmt.createInvoice')} (${invoiceTotal.toLocaleString()} ${cur})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
