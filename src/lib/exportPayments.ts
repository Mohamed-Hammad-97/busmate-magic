import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface PaymentExportRow {
  parentName: string;
  studentName: string;
  schoolName: string;
  lineNumber: string;
  paymentPhone: string;
  subscriptionType: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  progress: string;
  status: string;
  createdAt: string;
}

export interface InstallmentExportRow {
  parentName: string;
  studentName: string;
  schoolName: string;
  lineNumber: string;
  paymentPhone: string;
  subscriptionType: string;
  installmentLabel: string;
  installmentOrder: number;
  amount: number;
  extraFees: number;
  dueDate: string;
  paidDate: string;
  status: string;
  paidBy: string;
  note: string;
  noteStatus: string;
}

const HEADERS = [
  'Parent Name',
  'Student Name',
  'School',
  'Line No',
  'Payment Phone',
  'Subscription Type',
  'Total (EGP)',
  'Paid (EGP)',
  'Remaining (EGP)',
  'Progress',
  'Status',
  'Created At',
];

const DETAIL_HEADERS = [
  'Parent Name',
  'Student Name',
  'School',
  'Line No',
  'Payment Phone',
  'Subscription Type',
  'Installment',
  'Amount (EGP)',
  'Extra Fees (EGP)',
  'Due Date',
  'Paid Date',
  'Status',
  'Paid By',
  'Note',
  'Note Status',
];

const fmtDate = (d?: string | null) => (d ? format(new Date(d), 'yyyy-MM-dd') : '');

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
      schoolName: r.schoolName || '',
      lineNumber: r.lineNumber != null ? String(r.lineNumber) : '',
      paymentPhone: r.paymentPhone || '',
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

export function buildInstallmentRows(grouped: Record<string, any>): InstallmentExportRow[] {
  const rows: InstallmentExportRow[] = [];
  Object.values(grouped).forEach((r: any) => {
    const payments = [...(r.payments || [])].sort(
      (a: any, b: any) => Number(a.installment_number) - Number(b.installment_number)
    );
    payments.forEach((p: any) => {
      const num = Number(p.installment_number);
      const extraFees = (p.payment_extra_fees || []).reduce(
        (s: number, f: any) => s + Number(f.amount || 0),
        0
      );
      rows.push({
        parentName: r.parentName || '',
        studentName: r.studentName || '',
        schoolName: r.schoolName || '',
        lineNumber: r.lineNumber != null ? String(r.lineNumber) : '',
        paymentPhone: r.paymentPhone || '',
        subscriptionType: r.subscription?.subscription_type || '',
        installmentLabel: num === 0 ? 'Insurance' : `Installment ${num}`,
        installmentOrder: num,
        amount: Number(p.amount || 0),
        extraFees,
        dueDate: fmtDate(p.due_date),
        paidDate: fmtDate(p.paid_date),
        status: p.status || '',
        paidBy: p.paid_by_name || '',
        note: p.payment_note || '',
        noteStatus: p.payment_note ? (p.payment_note_resolved_at ? 'Resolved' : 'Open') : '',
      });
    });
  });
  return rows;
}

export function exportPaymentsExcel(grouped: Record<string, any>, filename = 'payments') {
  const rows = buildPaymentRows(grouped);
  const data = [HEADERS, ...rows.map((r) => [
    r.parentName, r.studentName, r.schoolName, r.lineNumber, r.paymentPhone, r.subscriptionType,
    r.totalAmount, r.paidAmount, r.remaining,
    r.progress, r.status, r.createdAt,
  ])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 18 }];

  const details = buildInstallmentRows(grouped);
  const detailData = [DETAIL_HEADERS, ...details.map((d) => [
    d.parentName, d.studentName, d.schoolName, d.lineNumber, d.paymentPhone, d.subscriptionType,
    d.installmentLabel, d.amount, d.extraFees, d.dueDate, d.paidDate, d.status, d.paidBy, d.note, d.noteStatus,
  ])];
  const wsDetails = XLSX.utils.aoa_to_sheet(detailData);
  wsDetails['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 18 }, { wch: 28 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Installments');
  XLSX.writeFile(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export function exportPaymentsPDF(grouped: Record<string, any>, filename = 'payments', title = 'Payments Report') {
  const rows = buildPaymentRows(grouped);
  const details = buildInstallmentRows(grouped);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  •  ${rows.length} records  •  ${details.length} installments`, 14, 20);
  autoTable(doc, {
    startY: 25,
    head: [HEADERS],
    body: rows.map((r) => [
      r.parentName, r.studentName, r.schoolName, r.lineNumber, r.paymentPhone, r.subscriptionType,
      r.totalAmount.toLocaleString(), r.paidAmount.toLocaleString(), r.remaining.toLocaleString(),
      r.progress, r.status, r.createdAt,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.addPage('a4', 'landscape');
  doc.setFontSize(12);
  doc.text('Installment Details', 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [DETAIL_HEADERS],
    body: details.map((d) => [
      d.parentName, d.studentName, d.schoolName, d.lineNumber, d.paymentPhone, d.subscriptionType,
      d.installmentLabel, d.amount.toLocaleString(), d.extraFees.toLocaleString(),
      d.dueDate, d.paidDate, d.status, d.paidBy, d.note, d.noteStatus,
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${filename}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
