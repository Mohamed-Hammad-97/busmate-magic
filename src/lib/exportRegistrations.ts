import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const HEADERS = [
  'Student Name',
  'Grade',
  'School',
  'Education Dept',
  'Car Type',
  'Status',
  'Parent Name',
  'Job',
  'National ID',
  'Father Phone',
  'Mother Phone',
  'Emergency Phone',
  'Payment Phone',
  'City',
  'Pickup Latitude',
  'Pickup Longitude',
  'Pickup Location (Maps)',
  'Comments',
  'Student Photo',
  'Created At',
  'Updated At',
];

function toRows(regs: any[]) {
  return regs.map((r) => {
    const p = r.parent_accounts || {};
    const s = r.schools || {};
    const lat = p.pickup_latitude;
    const lng = p.pickup_longitude;
    const mapLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '';
    return [
      r.student_name || '',
      r.grade || '',
      s.name || '',
      r.education_department || '',
      r.car_type === 'ac' ? 'AC' : r.car_type ? 'Non-AC' : '',
      r.status || '',
      p.parent_name || '',
      p.job || '',
      p.national_id || '',
      p.father_phone || '',
      p.mother_phone || '',
      p.emergency_phone || '',
      p.payment_phone || '',
      p.city || '',
      lat ?? '',
      lng ?? '',
      mapLink,
      r.comments || '',
      r.student_photo_url || '',
      r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '',
      r.updated_at ? format(new Date(r.updated_at), 'yyyy-MM-dd HH:mm') : '',
    ];
  });
}

export function exportRegistrationsExcel(regs: any[], filename = 'registrations') {
  const data = [HEADERS, ...toRows(regs)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(14, Math.min(h.length + 4, 28)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
  XLSX.writeFile(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export function exportRegistrationsPDF(regs: any[], filename = 'registrations', title = 'Registrations Report') {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  •  ${regs.length} records`, 14, 20);
  autoTable(doc, {
    startY: 25,
    head: [HEADERS],
    body: toRows(regs),
    styles: { fontSize: 6, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 6 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(`${filename}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
