import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { CalendarDays, Check, X, Save, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { useCity } from '@/contexts/CityContext';
import { makeCityMatcher } from './schoolStaff';

interface Props {
  canEdit: boolean;
  personType: 'driver' | 'supervisor';
}

export function SchoolAttendance({ canEdit, personType }: Props) {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { selectedCity } = useCity();
  const matchesCity = makeCityMatcher(selectedCity);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [schoolId, setSchoolId] = useState('all');
  const [routeId, setRouteId] = useState('all');
  const [localAtt, setLocalAtt] = useState<Record<string, boolean>>({});
  const [localFees, setLocalFees] = useState<Record<string, { amount: number; reason: string }>>({});

  const dow = new Date(`${selectedDate}T00:00:00`).getDay();
  const isWeekend = dow === 5 || dow === 6;

  const { data: schools = [] } = useQuery({
    queryKey: ['schools-for-attendance', selectedCity],
    queryFn: async () => {
      const { data, error } = await supabase.from('schools').select('id, name, city').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []).filter((s: any) => matchesCity(s.city));
    },
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['school-routes-attendance', personType, schoolId, routeId, selectedCity],
    queryFn: async () => {
      let q = supabase
        .from('routes')
        .select('id, name, route_number, school_id, driver_id, supervisor_id, schools(name, city), drivers(id, full_name), supervisors(id, full_name)')
        .eq('is_active', true);
      if (schoolId !== 'all') q = q.eq('school_id', schoolId);
      if (routeId !== 'all') q = q.eq('id', routeId);
      q = personType === 'driver' ? q.not('driver_id', 'is', null) : q.not('supervisor_id', 'is', null);
      const { data, error } = await q.order('route_number');
      if (error) throw error;
      return (data || []).filter((r: any) => matchesCity(r.schools?.city));
    },
  });

  const { data: routeOptions = [] } = useQuery({
    queryKey: ['school-routes-options', schoolId, selectedCity],
    queryFn: async () => {
      let q = supabase.from('routes').select('id, name, route_number, schools(city)').eq('is_active', true);
      if (schoolId !== 'all') q = q.eq('school_id', schoolId);
      const { data, error } = await q.order('route_number');
      if (error) throw error;
      return (data || []).filter((r: any) => matchesCity(r.schools?.city));
    },
  });

  const { data: attendance = [], refetch } = useQuery({
    queryKey: ['school-attendance', selectedDate, personType],
    queryFn: async () => {
      const { data, error } = await supabase.from('school_attendance').select('*').eq('attendance_date', selectedDate);
      if (error) throw error;
      return (data || []).filter((a: any) => (personType === 'driver' ? a.driver_id : a.supervisor_id));
    },
  });

  const record = (rId: string, shift: string) =>
    attendance.find((a: any) => a.route_id === rId && a.shift === shift);

  const getChecked = (rId: string, shift: string) => {
    const key = `${rId}-${shift}`;
    if (key in localAtt) return localAtt[key];
    return record(rId, shift)?.is_present ?? false;
  };

  const getFee = (rId: string) => {
    const key = rId;
    if (key in localFees) return localFees[key];
    const existing = record(rId, 'morning');
    return { amount: Number(existing?.extra_deduction_amount || 0), reason: existing?.extra_deduction_reason || '' };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ids = routes.map((r: any) => r.id);
      if (ids.length === 0) return;
      let del = supabase.from('school_attendance').delete().eq('attendance_date', selectedDate).in('route_id', ids);
      del = personType === 'driver' ? del.not('driver_id', 'is', null) : del.not('supervisor_id', 'is', null);
      const { error: delErr } = await del;
      if (delErr) throw delErr;

      const rows = routes.flatMap((r: any) => {
        const fee = getFee(r.id);
        return ['morning', 'return'].map((shift) => ({
          route_id: r.id,
          driver_id: personType === 'driver' ? r.driver_id : null,
          supervisor_id: personType === 'supervisor' ? r.supervisor_id : null,
          attendance_date: selectedDate,
          shift,
          is_present: getChecked(r.id, shift),
          extra_deduction_amount: shift === 'morning' ? fee.amount || 0 : 0,
          extra_deduction_reason: shift === 'morning' ? fee.reason || null : null,
        }));
      });
      if (rows.length > 0) {
        const { error } = await supabase.from('school_attendance').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => { setLocalAtt({}); setLocalFees({}); refetch(); toast.success(ar ? 'تم حفظ الحضور' : 'Attendance saved'); },
    onError: (e: any) => toast.error(e.message || (ar ? 'خطأ في الحفظ' : 'Save error')),
  });

  const shifts: { key: string; label: string }[] = [
    { key: 'morning', label: ar ? 'ذهاب' : 'Morning' },
    { key: 'return', label: ar ? 'عودة' : 'Return' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{ar ? 'التاريخ' : 'Date'}</Label>
          <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setLocalAtt({}); setLocalFees({}); }} dir="ltr" className="w-44" />
        </div>
        <div className="space-y-2">
          <Label>{ar ? 'المدرسة' : 'School'}</Label>
          <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); setRouteId('all'); }}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? 'كل المدارس' : 'All schools'}</SelectItem>
              {schools.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{ar ? 'الخط' : 'Route'}</Label>
          <Select value={routeId} onValueChange={setRouteId}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? 'كل الخطوط' : 'All routes'}</SelectItem>
              {routeOptions.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.route_number ? `#${r.route_number} - ` : ''}{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || routes.length === 0}>
            <Save className="h-4 w-4" />{saveMutation.isPending ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ الحضور' : 'Save attendance')}
          </Button>
        )}
      </div>

      {isWeekend && (
        <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          {ar ? 'هذا اليوم عطلة (الجمعة/السبت) ولا يُحسب ضمن أيام العمل الشهرية.' : 'This day is a weekend (Fri/Sat) and is not counted in the monthly working days.'}
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><CalendarDays className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {personType === 'driver' ? (ar ? 'حضور السائقين' : 'Drivers attendance') : (ar ? 'حضور المشرفين' : 'Supervisors attendance')} - {selectedDate}
            </h2>
            <p className="text-xs text-muted-foreground">{routes.length} {ar ? 'خط' : 'routes'}</p>
          </div>
        </div>

        {routes.length === 0 ? (
          <div className="p-16 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{ar ? 'لا توجد خطوط مدارس بها تعيين' : 'No school routes with an assigned person'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground">{ar ? 'الخط' : 'Route'}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground">{ar ? 'المدرسة' : 'School'}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground">{ar ? 'الاسم' : 'Name'}</TableHead>
                  {shifts.map((s) => <TableHead key={s.key} className="text-xs font-semibold uppercase text-muted-foreground text-center">{s.label}</TableHead>)}
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-center">{ar ? 'خصم إضافي' : 'Extra deduction'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r: any) => {
                  const person = personType === 'driver' ? r.drivers : r.supervisors;
                  const fee = getFee(r.id);
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium text-sm">
                        {r.route_number ? <Badge variant="outline" className="me-2 text-xs">#{r.route_number}</Badge> : null}{r.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.schools?.name}</TableCell>
                      <TableCell className="text-sm">{person?.full_name}</TableCell>
                      {shifts.map((s) => {
                        const checked = getChecked(r.id, s.key);
                        return (
                          <TableCell key={s.key} className="text-center">
                            {canEdit ? (
                              <Checkbox checked={checked} onCheckedChange={() => setLocalAtt((p) => ({ ...p, [`${r.id}-${s.key}`]: !checked }))} />
                            ) : checked ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-destructive mx-auto" />}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        {canEdit ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant={fee.amount > 0 ? 'default' : 'ghost'} size="sm" className="h-7 gap-1 text-xs">
                                <Minus className="h-3 w-3" />{fee.amount > 0 ? fee.amount : '+'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 space-y-3" align="end">
                              <p className="text-xs font-semibold">{ar ? 'خصم إضافي' : 'Extra deduction'}</p>
                              <div className="space-y-1.5">
                                <Label className="text-xs">{ar ? 'المبلغ' : 'Amount'}</Label>
                                <Input type="number" dir="ltr" className="h-8 text-xs" value={fee.amount || ''} onChange={(e) => setLocalFees((p) => ({ ...p, [r.id]: { ...fee, amount: Number(e.target.value) } }))} placeholder="0" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">{ar ? 'السبب' : 'Reason'}</Label>
                                <Input className="h-8 text-xs" value={fee.reason} onChange={(e) => setLocalFees((p) => ({ ...p, [r.id]: { ...fee, reason: e.target.value } }))} />
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : fee.amount > 0 ? <span className="text-xs font-mono text-destructive" title={fee.reason}>{fee.amount}</span> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
