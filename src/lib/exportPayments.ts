import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface PaymentExportRow {
  parentName: string;
  studentName: string;
  subscriptionType: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  progress: string;
  status: string;
  createdAt: string;
}

const HEADERS = [
  'Parent Name',
  'Student Name',
  'Subscription Type',
  'Total (EGP)',
  'Paid (EGP)',
  'Remaining (EGP)',
  'Progress',
  'Status',
  'Created At',
];

export function buildPaymentRows(grouped: Record<string, any>): PaymentExportRow[] {
  return Object.values(grouped).map((r: any) => {
    const total = Number(r.totalAmount) || 0;
    const paid = Number(r.paidAmount) || 0;
    const remaining = total - paid;
    const progress = total > 0 ? `${Math.round((paid / total) * 100)}%` : '0%';
    // Earliest payment created_at to represent record creation
    const createdDates = (r.payments || [])
      .map((p: any) => p.created_at)
      .filter(Boolean)
      .sort();
    const created = createdDates[0] || r.subscription?.created_at || '';
    return {
      parentName: r.parentName || '',
      studentName: r.studentName || '',
      subscriptionType: r.subscription?.subscription_type || '',
      totalAmount: total,
      paidAmount: paid,
      remaining,
      progress,
      status: r.isFullyPaid ? 'Fully Paid' : 'Partial',
      createdAt: created ? format(new Date(created), 'yyyy-MM-dd HH:mm') : '',
    };
  });
}

export function exportPaymentsExcel(grouped: Record<string, any>, filename = 'payments') {
  const rows = buildPaymentRows(grouped);
  const data = [HEADERS, ...rows.map((r) => [
    r.parentName, r.studentName, r.subscriptionType,
    r.totalAmount, r.paidAmount, r.remaining,
    r.progress, r.status, r.createdAt,
  ])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payments');
  XLSX.writeFile(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export function exportPaymentsPDF(grouped: Record<string, any>, filename = 'payments', title = 'Payments Report') {
  const rows = buildPaymentRows(grouped);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  •  ${rows.length} records`, 14, 20);
  autoTable(doc, {
    startY: 25,
    head: [HEADERS],
    body: rows.map((r) => [
      r.parentName, r.studentName, r.subscriptionType,
      r.totalAmount.toLocaleString(), r.paidAmount.toLocaleString(), r.remaining.toLocaleString(),
      r.progress, r.status, r.createdAt,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(`${filename}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
