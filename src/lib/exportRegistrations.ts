import { safeRows } from "@/lib/safeSheet";
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { createArabicPdf, withArabicTable, rtlRow, drawHeading } from './pdfArabic';

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
  const ws = XLSX.utils.aoa_to_sheet(safeRows(data));
  ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(14, Math.min(h.length + 4, 28)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
  XLSX.writeFile(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

const HEADERS_AR = [
  'اسم الطالب',
  'الصف',
  'المدرسة',
  'القسم التعليمي',
  'نوع السيارة',
  'الحالة',
  'اسم ولي الأمر',
  'الوظيفة',
  'الرقم القومي',
  'رقم الأب',
  'رقم الأم',
  'رقم الطوارئ',
  'رقم الدفع والتجديد',
  'المدينة',
  'خط العرض',
  'خط الطول',
  'موقع الالتقاط (خرائط)',
  'ملاحظات',
  'صورة الطالب',
  'تاريخ الإنشاء',
  'تاريخ التحديث',
];

export async function exportRegistrationsPDF(
  regs: any[],
  filename = 'registrations',
  title = 'Registrations Report',
  isRtl = false
) {
  const doc = await createArabicPdf({ orientation: 'landscape', format: 'a3' });
  doc.setFontSize(14);
  drawHeading(doc, title, 14, isRtl);
  doc.setFontSize(9);
  drawHeading(
    doc,
    isRtl
      ? `تاريخ التصدير: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  •  ${regs.length} سجل`
      : `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  •  ${regs.length} records`,
    20,
    isRtl
  );
  autoTable(doc, withArabicTable(doc, isRtl, {
    startY: 25,
    head: [rtlRow(isRtl ? HEADERS_AR : HEADERS, isRtl)],
    body: toRows(regs).map((r) => {
      if (!isRtl) return r;
      const AR: Record<string, string> = {
        AC: 'مكيفة',
        'Non-AC': 'غير مكيفة',
        pending: 'قيد المراجعة',
        approved: 'مقبول',
        rejected: 'مرفوض',
        completed: 'مكتمل',
        cancelled: 'ملغي',
        active: 'نشط',
      };
      const localized = r.map((c, i) => (i === 4 || i === 5 ? AR[String(c)] || c : c));
      return rtlRow(localized, isRtl);
    }),
    styles: { fontSize: 6, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 6 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  }));
  doc.save(`${filename}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
