import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer, FileText } from 'lucide-react';
import autoTable from 'jspdf-autotable';
import { createArabicPdf, withArabicTable, rtlRow } from '@/lib/pdfArabic';

const MIN_ROWS = 15;
const EMERGENCY_PHONE = '01112811711';

/** Maps a grade to the short stage code used on the printed sheet. */
export function stageCode(grade?: string | null): string {
  if (!grade) return '';
  const g = String(grade).trim();
  if (/kg/i.test(g)) {
    const k = g.match(/(\d+)/);
    return `KG${k ? k[1] : '1'}`;
  }
  const m = g.match(/(\d+)/);
  if (!m) return g;
  const n = parseInt(m[1], 10);
  if (n >= 1 && n <= 6) return `J${n}`;
  if (n >= 7 && n <= 9) return `M${n - 6}`;
  if (n >= 10 && n <= 12) return `S${n - 9}`;
  return g;
}

interface Props {
  canEdit?: boolean;
}

const PrintTablesTab: React.FC<Props> = () => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [lineInput, setLineInput] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const { data: routes = [] } = useQuery({
    queryKey: ['print-tables-routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          id, name, route_number,
          schools (name),
          drivers (full_name, phone),
          supervisors (full_name, phone)
        `)
        .order('route_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const route = useMemo(
    () => (routes as any[]).find((r) => r.id === selectedRouteId) || null,
    [routes, selectedRouteId],
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['print-table-students', route?.id],
    enabled: !!route?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_assignments')
        .select(`
          pickup_order,
          registrations (
            student_name,
            grade,
            status,
            schools (name)
          )
        `)
        .eq('route_id', route.id);
      if (error) throw error;
      return (data || [])
        .filter((a: any) => a.registrations && a.registrations.status !== 'cancelled')
        .map((a: any) => ({
          order: a.pickup_order ?? 0,
          student_name: a.registrations?.student_name || '',
          school_name: a.registrations?.schools?.name || '',
          stage: stageCode(a.registrations?.grade),
        }))
        .sort((x, y) => x.order - y.order);
    },
  });

  const showLine = () => {
    const num = parseInt(lineInput, 10);
    const found = (routes as any[]).find((r) => Number(r.route_number) === num);
    setSelectedRouteId(found ? found.id : null);
  };

  const lineNo = route?.route_number ?? '';
  const supervisorName = route?.supervisors?.full_name || '';
  const supervisorPhone = route?.supervisors?.phone || '';
  const driverName = route?.drivers?.full_name || '';
  const schoolName = route?.schools?.name || '';

  const paddedRows = useMemo(() => {
    const list = rows.map((r, i) => ({ ...r, serial: `${lineNo}-${i + 1}` }));
    while (list.length < MIN_ROWS) {
      list.push({
        order: 0,
        student_name: '',
        school_name: '',
        stage: '',
        serial: `${lineNo}-${list.length + 1}`,
      } as any);
    }
    return list;
  }, [rows, lineNo]);

  const handlePrint = () => window.print();

  const exportPdf = async () => {
    const doc = await createArabicPdf();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(22);
    doc.setTextColor(31, 116, 165);
    doc.text('Seater', pageWidth / 2, 20, { align: 'center' });
    doc.setDrawColor(31, 116, 165);
    doc.line(pageWidth / 2 - 25, 23, pageWidth / 2 + 25, 23);

    doc.setFontSize(14);
    doc.setTextColor(31, 116, 165);
    doc.text('كشف بأسماء الطلاب', pageWidth / 2, 32, { align: 'center' });

    autoTable(doc, withArabicTable(doc, true, {
      startY: 38,
      head: [rtlRow([`خط رقم: ${lineNo}`, 'المشرفة', 'السائق'], true)],
      body: [
        rtlRow(
          [schoolName, `${supervisorName}${supervisorPhone ? ` - ت: ${supervisorPhone}` : ''} - ر.ق:`, driverName],
          true,
        ),
      ],
      theme: 'grid',
      styles: { fontSize: 9, halign: 'center' },
      headStyles: { fillColor: [31, 116, 165], textColor: 255, halign: 'center' },
    }));

    autoTable(doc, withArabicTable(doc, true, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      head: [rtlRow(['', 'مسلسل الخط', 'اسم الطالب/ة:', 'المدرسة:', 'المرحلة:'], true)],
      body: paddedRows.map((r) =>
        rtlRow(['', r.serial, r.student_name, r.school_name, r.stage], true),
      ),
      theme: 'grid',
      styles: { fontSize: 9, halign: 'center', cellPadding: 2.5 },
      headStyles: { fillColor: [31, 116, 165], textColor: 255, halign: 'center' },
      columnStyles: { 4: { cellWidth: 10, fillColor: [220, 236, 245] } },
    }));


    const y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(`للطوارئ: ${EMERGENCY_PHONE}`, pageWidth - 14, y, { align: 'right' });
    doc.text(`عدد الطلبة: ${rows.length}`, 14, y);

    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('Seater للنقل الذكي ش.م.م. - س.ت: 191191، استثمار القاهرة', pageWidth / 2, 278, { align: 'center' });
    doc.text('Street 33, Villa 53, First Floor, District 3, Sheikh Zayed City, Giza, Egypt.', pageWidth / 2, 283, { align: 'center' });
    doc.text('336 El Gaish road, Al Saraya Royal Plaza, Building D, 101, Saba Pasha, Alexandria.', pageWidth / 2, 288, { align: 'center' });
    doc.text('Contactus@seaterapp.com  035869421 - 035866436 - 0238522045  |  https://www.seater.org', pageWidth / 2, 293, { align: 'center' });

    doc.save(`students-sheet-line-${lineNo}.pdf`);
  };

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-sheet, #print-sheet * { visibility: visible !important; }
          #print-sheet {
            position: absolute; inset: 0; margin: 0; width: 100%;
            border: none !important; box-shadow: none !important;
          }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>

      <Card className="print:hidden">
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>{isRtl ? 'رقم الخط' : 'Line number'}</Label>
            <Input
              className="w-36"
              value={lineInput}
              inputMode="numeric"
              onChange={(e) => setLineInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && showLine()}
              placeholder={isRtl ? 'مثال: 6' : 'e.g. 6'}
            />
          </div>
          <Button onClick={showLine}>{isRtl ? 'عرض' : 'Show'}</Button>

          <div className="space-y-1">
            <Label>{isRtl ? 'أو اختر الخط' : 'Or pick a line'}</Label>
            <Select
              value={selectedRouteId ?? undefined}
              onValueChange={(v) => {
                setSelectedRouteId(v);
                const r = (routes as any[]).find((x) => x.id === v);
                setLineInput(r?.route_number ? String(r.route_number) : '');
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={isRtl ? 'اختر الخط' : 'Select line'} />
              </SelectTrigger>
              <SelectContent>
                {(routes as any[]).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    #{r.route_number ?? '-'} — {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 ms-auto">
            <Button variant="outline" onClick={handlePrint} disabled={!route}>
              <Printer className="h-4 w-4 me-2" />
              {isRtl ? 'طباعة' : 'Print'}
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={!route}>
              <FileText className="h-4 w-4 me-2" />
              {isRtl ? 'تحميل PDF' : 'Download PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!route ? (
        <p className="text-muted-foreground text-sm print:hidden">
          {isRtl ? 'أدخل رقم الخط لعرض الكشف' : 'Enter a line number to show the sheet'}
        </p>
      ) : isLoading ? (
        <p className="text-muted-foreground text-sm">{isRtl ? 'جاري التحميل...' : 'Loading...'}</p>
      ) : (
        <div
          id="print-sheet"
          dir="rtl"
          className="mx-auto w-full max-w-[820px] bg-white text-black p-8 border rounded-md"
        >
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: '#1f74a5' }}>Seater</div>
            <div className="mx-auto mt-1 h-[2px] w-40" style={{ background: '#1f74a5' }} />
            <div className="mt-3 text-lg font-semibold" style={{ color: '#1f74a5' }}>
              كشف بأسماء الطلاب
            </div>
          </div>

          <table className="mt-4 w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border p-2 text-center font-semibold" style={{ background: '#1f74a5', color: '#fff' }}>
                  خط رقم: {lineNo}
                </td>
                <td className="border p-2 text-center font-semibold" style={{ background: '#1f74a5', color: '#fff' }}>
                  المشرفة
                </td>
                <td className="border p-2 text-center font-semibold" style={{ background: '#1f74a5', color: '#fff' }}>
                  السائق
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-center">{schoolName}</td>
                <td className="border p-2 text-center">
                  {supervisorName} {supervisorPhone ? `- ت: ${supervisorPhone}` : ''} - ر.ق:
                </td>
                <td className="border p-2 text-center">{driverName}</td>
              </tr>
            </tbody>
          </table>

          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: '#1f74a5', color: '#fff' }}>
                <th className="border p-2 w-10" />
                <th className="border p-2">مسلسل الخط</th>
                <th className="border p-2">اسم الطالب/ة:</th>
                <th className="border p-2">المدرسة:</th>
                <th className="border p-2">المرحلة:</th>
              </tr>
            </thead>
            <tbody>
              {paddedRows.map((r, i) => (
                <tr key={i}>
                  <td className="border p-2 text-center" style={{ background: '#dcecf5' }}>
                    <span className="inline-block h-3.5 w-3.5 border border-gray-500" />
                  </td>
                  <td className="border p-2 text-center">{(r as any).serial}</td>
                  <td className="border p-2 text-center">{r.student_name}</td>
                  <td className="border p-2 text-center">{r.school_name}</td>
                  <td className="border p-2 text-center">{r.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex justify-between text-sm font-semibold">
            <span>عدد الطلبة: {rows.length}</span>
            <span>للطوارئ: {EMERGENCY_PHONE}</span>
          </div>

          <div className="mt-6 text-center text-[10px] leading-4 text-gray-600">
            <div>Seater للنقل الذكي ش.م.م. — س.ت: 191191، استثمار القاهرة</div>
            <div>Street 33, Villa 53, First Floor, District 3, Sheikh Zayed City, Giza, Egypt.</div>
            <div>336 El Gaish road, Al Saraya Royal Plaza, Building D, 101, Saba Pasha, Alexandria.</div>
            <div>Contactus@seaterapp.com · 035869421 - 035866436 - 0238522045 · https://www.seater.org</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintTablesTab;
