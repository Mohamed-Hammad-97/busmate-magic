import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { safeRows } from '@/lib/safeSheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, MapPin, Phone, Search } from 'lucide-react';

export function CompanyRegistrationsTab({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [line, setLine] = useState('all');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['admin-company-employees', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_employees')
        .select('*, company_lines(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const lines = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => e.company_line_id && m.set(e.company_line_id, e.company_lines?.name || '-'));
    return [...m.entries()];
  }, [employees]);

  const filtered = employees.filter((e) => {
    if (status === 'active' && !e.is_active) return false;
    if (status === 'pending' && e.is_active) return false;
    if (line === 'custom' && e.company_line_id) return false;
    if (line !== 'all' && line !== 'custom' && e.company_line_id !== line) return false;
    const q = search.trim().toLowerCase();
    return !q || e.full_name?.toLowerCase().includes(q) || e.phone?.includes(q);
  });

  const exportExcel = () => {
    const rows = [
      ['الاسم', 'الهاتف', 'القسم', 'الخط', 'عنوان الاستلام', 'الحالة', 'تاريخ التسجيل'],
      ...filtered.map((e) => [
        e.full_name, e.phone, e.department || '', e.company_lines?.name || 'استلام مخصص',
        e.pickup_address || '', e.is_active ? 'مفعل' : 'قيد المراجعة',
        format(new Date(e.created_at), 'yyyy-MM-dd'),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(safeRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `${companyName}-employees.xlsx`);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="بحث بالاسم أو الهاتف" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">مفعل</SelectItem>
            <SelectItem value="pending">قيد المراجعة</SelectItem>
          </SelectContent>
        </Select>
        <Select value={line} onValueChange={setLine}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الخطوط</SelectItem>
            <SelectItem value="custom">استلام مخصص</SelectItem>
            {lines.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2" onClick={exportExcel} disabled={!filtered.length}>
          <Download className="h-4 w-4" /> Excel
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{filtered.length} موظف</p>
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">لا توجد تسجيلات</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((e) => (
            <Card key={e.id} className="rounded-2xl">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{e.full_name}</p>
                  <Badge variant={e.is_active ? 'default' : 'secondary'}>{e.is_active ? 'مفعل' : 'قيد المراجعة'}</Badge>
                </div>
                <a href={`tel:${e.phone}`} className="flex items-center gap-2 text-sm text-primary"><Phone className="h-4 w-4" />{e.phone}</a>
                <p className="text-sm">الخط: {e.company_lines?.name || 'استلام مخصص'}{e.department ? ` · ${e.department}` : ''}</p>
                {e.pickup_address && (
                  <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    {e.pickup_latitude && e.pickup_longitude ? (
                      <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${e.pickup_latitude},${e.pickup_longitude}`}>{e.pickup_address}</a>
                    ) : e.pickup_address}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">تاريخ التسجيل: {format(new Date(e.created_at), 'yyyy-MM-dd')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
