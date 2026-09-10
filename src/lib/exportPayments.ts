import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { createArabicPdf, withArabicTable, rtlRow, drawHeading } from './pdfArabic';

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

const HEADERS_AR = [
  'اسم ولي الأمر',
  'اسم الطالب',
  'المدرسة',
  'رقم الخط',
  'رقم الدفع والتجديد',
  'نوع الاشتراك',
  'الإجمالي بالجنيه',
  'المدفوع بالجنيه',
  'المتبقي بالجنيه',
  'نسبة السداد',
  'الحالة',
  'تاريخ الإنشاء',
];

const DETAIL_HEADERS_AR = [
  'اسم ولي الأمر',
  'اسم الطالب',
  'المدرسة',
  'رقم الخط',
  'رقم الدفع والتجديد',
  'نوع الاشتراك',
  'القسط',
  'المبلغ بالجنيه',
  'رسوم إضافية بالجنيه',
  'تاريخ الاستحقاق',
  'تاريخ السداد',
  'الحالة',
  'تم السداد بواسطة',
  'ملاحظة',
  'حالة الملاحظة',
];

export async function exportPaymentsPDF(
  grouped: Record<string, any>,
  filename = 'payments',
  title = 'Payments Report',
  isRtl = false
) {
  const rows = buildPaymentRows(grouped);
  const details = buildInstallmentRows(grouped);
  const AR_LABELS: Record<string, string> = {
    'Fully Paid': 'مدفوع بالكامل',
    Partial: 'سداد جزئي',
    Resolved: 'تم الحل',
    Open: 'مفتوحة',
    paid: 'مدفوع',
    pending: 'قيد الانتظار',
    overdue: 'متأخر',
    monthly: 'شهري',
    yearly: 'سنوي',
  };
  const L = (v: string) => (isRtl && v ? AR_LABELS[v] || v : v);
  const head = isRtl ? HEADERS_AR : HEADERS;
  const detailHead = isRtl ? DETAIL_HEADERS_AR : DETAIL_HEADERS;
  const doc = await createArabicPdf({ orientation: 'landscape' });
  doc.setFontSize(14);
  drawHeading(doc, title, 14, isRtl);
  doc.setFontSize(9);
  const meta = isRtl
    ? `تاريخ التصدير: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  •  ${rows.length} سجل  •  ${details.length} قسط`
    : `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  •  ${rows.length} records  •  ${details.length} installments`;
  drawHeading(doc, meta, 20, isRtl);
  autoTable(doc, withArabicTable(doc, isRtl, {
    startY: 25,
    head: [rtlRow(head, isRtl)],
    body: rows.map((r) => rtlRow([
      r.parentName, r.studentName, r.schoolName, r.lineNumber, r.paymentPhone, r.subscriptionType,
      r.totalAmount.toLocaleString(), r.paidAmount.toLocaleString(), r.remaining.toLocaleString(),
      r.progress, r.status, r.createdAt,
    ], isRtl)),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  }));

  doc.addPage('a4', 'landscape');
  doc.setFontSize(12);
  drawHeading(doc, isRtl ? 'تفاصيل الأقساط' : 'Installment Details', 14, isRtl);
  autoTable(doc, withArabicTable(doc, isRtl, {
    startY: 20,
    head: [rtlRow(detailHead, isRtl)],
    body: details.map((d) => rtlRow([
      d.parentName, d.studentName, d.schoolName, d.lineNumber, d.paymentPhone, d.subscriptionType,
      isRtl ? (d.installmentOrder === 0 ? 'التأمين' : `القسط ${d.installmentOrder}`) : d.installmentLabel,
      d.amount.toLocaleString(), d.extraFees.toLocaleString(),
      d.dueDate, d.paidDate, d.status, d.paidBy, d.note, d.noteStatus,
    ], isRtl)),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  }));

  doc.save(`${filename}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
