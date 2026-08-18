import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, FileText, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface RouteStudentsDialogProps {
  route: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RouteStudentsDialog: React.FC<RouteStudentsDialogProps> = ({ route, open, onOpenChange }) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['route-students', route?.id],
    enabled: !!route?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_assignments')
        .select(`
          pickup_order,
          registrations (
            id,
            student_name,
            grade,
            parent_accounts (
              parent_name,
              mother_phone,
              father_phone,
              payment_phone,
              pickup_address,
              pickup_latitude,
              pickup_longitude
            )
          )
        `)
        .eq('route_id', route.id);
      if (error) throw error;
      return (data || [])
        .map((a: any) => {
          const p = a.registrations?.parent_accounts || {};
          return {
            order: a.pickup_order ?? 0,
            student_name: a.registrations?.student_name || '',
            grade: a.registrations?.grade || '',
            parent_name: p.parent_name || '',
            mother_phone: p.mother_phone || '',
            father_phone: p.father_phone || '',
            payment_phone: p.payment_phone || '',
            address: p.pickup_address || '',
            maps:
              p.pickup_latitude && p.pickup_longitude
                ? `https://www.google.com/maps?q=${p.pickup_latitude},${p.pickup_longitude}`
                : '',
          };
        })
        .sort((a, b) => a.order - b.order);
    },
  });

  const fileBase = `route-${route?.route_number ?? ''}-${(route?.name || 'students').replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}`;

  const HEADERS = ['#', 'Student Name', 'Grade', 'Parent Name', 'Mother Phone', 'Payment Phone', 'Father Phone', 'Location Address', 'Map Link'];

  const toArray = () =>
    rows.map((r, i) => [i + 1, r.student_name, r.grade, r.parent_name, r.mother_phone, r.payment_phone, r.father_phone, r.address, r.maps]);

  const exportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...toArray()]);
    ws['!cols'] = [{ wch: 5 }, { wch: 24 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 50 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`Route #${route?.route_number ?? '-'} - ${route?.name || ''}`, 14, 14);
    doc.setFontSize(10);
    doc.text(`School: ${route?.schools?.name || '-'}  |  Students: ${rows.length}`, 14, 21);
    autoTable(doc, {
      head: [HEADERS],
      body: toArray().map((r) => r.map((c) => String(c ?? ''))),
      startY: 26,
      styles: { fontSize: 8, cellWidth: 'wrap' },
      columnStyles: { 7: { cellWidth: 65 }, 8: { cellWidth: 50 } },
    });
    doc.save(`${fileBase}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Users className="h-5 w-5" />
            <span>
              {isRtl ? 'طلاب الخط' : 'Route Students'} — #{route?.route_number ?? '-'} {route?.name}
            </span>
            <Badge variant="secondary">{rows.length}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={rows.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {isRtl ? 'تصدير Excel' : 'Export Excel'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={rows.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            {isRtl ? 'تصدير PDF' : 'Export PDF'}
          </Button>
        </div>

        <div className="overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={isRtl ? 'text-right' : 'text-left'}>#</TableHead>
                <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'اسم الطالب' : 'Student Name'}</TableHead>
                <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'رقم الأم' : 'Mother Phone'}</TableHead>
                <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'عنوان الموقع' : 'Location Address'}</TableHead>
                <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'الخريطة' : 'Map'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {isRtl ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {isRtl ? 'لا يوجد طلاب على هذا الخط' : 'No students on this route'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={`${r.student_name}-${i}`}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{r.student_name}</TableCell>
                    <TableCell dir="ltr" className="whitespace-nowrap">{r.mother_phone || '-'}</TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap break-words">{r.address || '-'}</TableCell>
                    <TableCell>
                      {r.maps ? (
                        <a href={r.maps} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                          {isRtl ? 'عرض' : 'View'}
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteStudentsDialog;
