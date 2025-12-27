import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ data, variant = 'button' }) => {
  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('INVOICE / فاتورة', 105, 20, { align: 'center' });
      
      // Invoice Info
      doc.setFontSize(10);
      doc.setTextColor(100);
      const invoiceNumber = `INV-${data.registrationId.slice(0, 8).toUpperCase()}`;
      const invoiceDate = format(new Date(), 'dd MMM yyyy');
      
      doc.text(`Invoice #: ${invoiceNumber}`, 20, 35);
      doc.text(`Date: ${invoiceDate}`, 20, 42);
      
      // Customer Info
      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text('Bill To:', 20, 55);
      doc.setFontSize(10);
      doc.text(`Parent: ${data.parentName}`, 20, 63);
      doc.text(`Student: ${data.studentName}`, 20, 70);
      doc.text(`Subscription: ${data.subscriptionType === 'monthly' ? 'Monthly' : 'Yearly'}`, 20, 77);
      
      // Payments Table
      const tableData = data.payments.map(p => [
        p.installment_number,
        `${Number(p.amount).toLocaleString()} EGP`,
        format(new Date(p.due_date), 'dd MMM yyyy'),
        p.paid_date ? format(new Date(p.paid_date), 'dd MMM yyyy') : '-',
        p.status === 'paid' ? 'Paid' : p.status === 'overdue' ? 'Overdue' : 'Pending'
      ]);
      
      doc.autoTable({
        startY: 90,
        head: [['#', 'Amount', 'Due Date', 'Paid Date', 'Status']],
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
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 40 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 30 }
        }
      });
      
      // Summary
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFontSize(11);
      doc.setTextColor(40);
      
      doc.text('Summary:', 20, finalY);
      doc.setFontSize(10);
      doc.text(`Total Amount: ${data.totalAmount.toLocaleString()} EGP`, 20, finalY + 8);
      doc.text(`Amount Paid: ${data.paidAmount.toLocaleString()} EGP`, 20, finalY + 15);
      
      const remaining = data.totalAmount - data.paidAmount;
      if (remaining > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Remaining: ${remaining.toLocaleString()} EGP`, 20, finalY + 22);
      } else {
        doc.setTextColor(22, 163, 74);
        doc.text('Status: FULLY PAID', 20, finalY + 22);
      }
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Thank you for your business!', 105, 280, { align: 'center' });
      doc.text('This is a computer-generated invoice.', 105, 285, { align: 'center' });
      
      // Save
      doc.save(`Invoice-${data.studentName || data.parentName}-${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('تم تحميل الفاتورة بنجاح');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('حدث خطأ أثناء إنشاء الفاتورة');
    }
  };
  
  if (variant === 'icon') {
    return (
      <Button variant="ghost" size="sm" onClick={generatePDF} title="تحميل الفاتورة">
        <Download className="h-4 w-4" />
      </Button>
    );
  }
  
  return (
    <Button variant="outline" onClick={generatePDF} className="gap-2">
      <FileText className="h-4 w-4" />
      تحميل الفاتورة
    </Button>
  );
};
