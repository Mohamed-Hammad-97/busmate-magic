import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTranslation } from 'react-i18next';
import { createArabicPdf, withArabicTable, rtlRow, drawHeading } from '@/lib/pdfArabic';

interface InvoiceData {
  parentName: string;
  studentName: string;
  subscriptionType: string;
  totalAmount: number;
  paidAmount: number;
  payments: {
    installment_number: number;
    amount: number;
    due_date: string;
    paid_date: string | null;
    status: string;
  }[];
  registrationId: string;
}

interface InvoiceGeneratorProps {
  data: InvoiceData;
  variant?: 'button' | 'icon';
}

const buildPDF = async (data: InvoiceData, isRtl: boolean): Promise<jsPDF> => {
  const doc = await createArabicPdf();
  const right = (text: string, y: number) => drawHeading(doc, text, y, isRtl, 20);

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text(isRtl ? 'فاتورة' : 'INVOICE', 105, 20, { align: 'center' });

  // Invoice Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  const invoiceNumber = `INV-${data.registrationId.slice(0, 8).toUpperCase()}`;
  const invoiceDate = format(new Date(), 'dd MMM yyyy');

  right(`${isRtl ? 'رقم الفاتورة' : 'Invoice #'}: ${invoiceNumber}`, 35);
  right(`${isRtl ? 'التاريخ' : 'Date'}: ${invoiceDate}`, 42);

  // Customer Info
  doc.setFontSize(12);
  doc.setTextColor(40);
  right(isRtl ? 'فاتورة إلى:' : 'Bill To:', 55);
  doc.setFontSize(10);
  right(`${isRtl ? 'ولي الأمر' : 'Parent'}: ${data.parentName}`, 63);
  right(`${isRtl ? 'الطالب' : 'Student'}: ${data.studentName}`, 70);
  const subType = data.subscriptionType === 'monthly'
    ? (isRtl ? 'شهري' : 'Monthly')
    : (isRtl ? 'سنوي' : 'Yearly');
  right(`${isRtl ? 'نوع الاشتراك' : 'Subscription'}: ${subType}`, 77);

  const currency = isRtl ? 'ج.م' : 'EGP';
  const statusLabel = (s: string) =>
    s === 'paid' ? (isRtl ? 'مدفوع' : 'Paid')
      : s === 'overdue' ? (isRtl ? 'متأخر' : 'Overdue')
        : (isRtl ? 'قيد الانتظار' : 'Pending');

  // Payments Table
  const tableData = data.payments.map(p => rtlRow([
    String(p.installment_number),
    `${Number(p.amount).toLocaleString()} ${currency}`,
    format(new Date(p.due_date), 'dd MMM yyyy'),
    p.paid_date ? format(new Date(p.paid_date), 'dd MMM yyyy') : '-',
    statusLabel(p.status),
  ], isRtl));

  const head = isRtl
    ? ['#', 'المبلغ', 'تاريخ الاستحقاق', 'تاريخ السداد', 'الحالة']
    : ['#', 'Amount', 'Due Date', 'Paid Date', 'Status'];

  autoTable(doc, withArabicTable(doc, isRtl, {
    startY: 90,
    head: [rtlRow(head, isRtl)],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
  }));

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 15;

  doc.setFontSize(11);
  doc.setTextColor(40);

  right(isRtl ? 'الملخص:' : 'Summary:', finalY);
  doc.setFontSize(10);
  right(`${isRtl ? 'إجمالي المبلغ' : 'Total Amount'}: ${data.totalAmount.toLocaleString()} ${currency}`, finalY + 8);
  right(`${isRtl ? 'المبلغ المدفوع' : 'Amount Paid'}: ${data.paidAmount.toLocaleString()} ${currency}`, finalY + 15);

  const remaining = data.totalAmount - data.paidAmount;
  if (remaining > 0) {
    doc.setTextColor(220, 38, 38);
    right(`${isRtl ? 'المتبقي' : 'Remaining'}: ${remaining.toLocaleString()} ${currency}`, finalY + 22);
  } else {
    doc.setTextColor(22, 163, 74);
    right(isRtl ? 'الحالة: تم السداد بالكامل' : 'Status: FULLY PAID', finalY + 22);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(isRtl ? 'شكراً لتعاملكم معنا!' : 'Thank you for your business!', 105, 280, { align: 'center' });
  doc.text(isRtl ? 'هذه فاتورة صادرة إلكترونياً.' : 'This is a computer-generated invoice.', 105, 285, { align: 'center' });

  return doc;
};

export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ data, variant = 'button' }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const openPreview = async () => {
    try {
      const doc = await buildPDF(data, isRtl);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('حدث خطأ أثناء إنشاء الفاتورة');
    }
  };

  const handleDownload = async () => {
    try {
      const doc = await buildPDF(data, isRtl);
      doc.save(`Invoice-${data.studentName || data.parentName}-${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('تم تحميل الفاتورة بنجاح');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('حدث خطأ أثناء إنشاء الفاتورة');
    }
  };

  const handleClose = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <>
      {variant === 'icon' ? (
        <Button variant="ghost" size="sm" onClick={openPreview} title="تحميل الفاتورة">
          <FileText className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" onClick={openPreview} className="gap-2">
          <FileText className="h-4 w-4" />
          تحميل الفاتورة
        </Button>
      )}

      <Dialog open={previewOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">معاينة الفاتورة</DialogTitle>
              <Button onClick={handleDownload} className="gap-2" size="sm">
                <Download className="h-4 w-4" />
                تحميل PDF
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full rounded-lg border"
                style={{ height: '70vh' }}
                title="Invoice Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
