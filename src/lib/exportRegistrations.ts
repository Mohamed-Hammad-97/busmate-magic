import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const HEADERS = [
  'Student Name',
  'Parent Name',
  'Parent Phone',
  'Payment Phone',
  'School',
  'Grade',
  'Car Type',
  'City',
  'Status',
  'Comments',
  'Created At',
];

function toRows(regs: any[]) {
  return regs.map((r) => [
    r.student_name || '',
    r.parent_accounts?.parent_name || '',
    r.parent_accounts?.phone || '',
    (r.parent_accounts as any)?.payment_phone || '',
    r.schools?.name || '',
    r.grade || '',
    r.car_type === 'ac' ? 'AC' : 'Non-AC',
    r.parent_accounts?.city || '',
    r.status || '',
    (r as any).comments || '',
    r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '',
  ]);
}

export function exportRegistrationsExcel(regs: any[], filename = 'registrations') {
  const data = [HEADERS, ...toRows(regs)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
  XLSX.writeFile(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export function exportRegistrationsPDF(regs: any[], filename = 'registrations', title = 'Registrations Report') {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  •  ${regs.length} records`, 14, 20);
  autoTable(doc, {
    startY: 25,
    head: [HEADERS],
    body: toRows(regs),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(`${filename}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
