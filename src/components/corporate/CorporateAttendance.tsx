import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CalendarDays, Check, X, Save } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';
import { ar } from 'date-fns/locale';

interface CorporateAttendanceProps {
  canEdit: boolean;
  staffContext?: 'school' | 'corporate';
}

export function CorporateAttendance({ canEdit, staffContext }: CorporateAttendanceProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: lines = [] } = useQuery({
    queryKey: ['company-lines-for-attendance', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('company_lines')
        .select(`
          id, name, number_of_shifts, price_per_shift, company_id,
          driver:drivers(id, full_name),
          supervisor:supervisors(id, full_name),
          company:companies(id, name)
        `)
        .eq('is_active', true);

      if (selectedCompanyId !== 'all') {
        query = query.eq('company_id', selectedCompanyId);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: attendance = [], refetch: refetchAttendance } = useQuery({
    queryKey: ['corporate-attendance', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corporate_driver_attendance')
        .select('*')
        .eq('attendance_date', selectedDate);
      if (error) throw error;
      return data;
    },
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: async (records: any[]) => {
      // Delete existing records for this date and lines
      const lineIds = records.map(r => r.company_line_id);
      await supabase
        .from('corporate_driver_attendance')
        .delete()
        .eq('attendance_date', selectedDate)
        .in('company_line_id', lineIds);

      // Insert new records
      if (records.length > 0) {
        const { error } = await supabase.from('corporate_driver_attendance').insert(records);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchAttendance();
      toast.success('تم حفظ الحضور');
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const getAttendanceForLine = (lineId: string, personType: 'driver' | 'supervisor', shiftNum: number) => {
    return attendance.find((a: any) =>
      a.company_line_id === lineId &&
      a.shift_number === shiftNum &&
      (personType === 'driver' ? a.driver_id : a.supervisor_id)
    );
  };

  const handleSaveAll = () => {
    const records: any[] = [];

    lines.forEach((line: any) => {
      for (let shift = 1; shift <= line.number_of_shifts; shift++) {
        // Check if driver attendance is marked
        const driverKey = `${line.id}-driver-${shift}`;
        const driverEl = document.querySelector(`[data-attendance="${driverKey}"]`) as HTMLInputElement;
        if (line.driver && driverEl) {
          records.push({
            company_line_id: line.id,
            driver_id: line.driver.id,
            attendance_date: selectedDate,
            shift_number: shift,
            shift_rate: line.price_per_shift,
            is_present: driverEl.dataset.checked === 'true',
          });
        }

        const supervisorKey = `${line.id}-supervisor-${shift}`;
        const supervisorEl = document.querySelector(`[data-attendance="${supervisorKey}"]`) as HTMLInputElement;
        if (line.supervisor && supervisorEl) {
          records.push({
            company_line_id: line.id,
            supervisor_id: line.supervisor.id,
            attendance_date: selectedDate,
            shift_number: shift,
            shift_rate: line.price_per_shift,
            is_present: supervisorEl.dataset.checked === 'true',
          });
        }
      }
    });

    saveAttendanceMutation.mutate(records);
  };

  // Local state for attendance checkboxes
  const [localAttendance, setLocalAttendance] = useState<Record<string, boolean>>({});

  const getChecked = (lineId: string, personType: string, shift: number) => {
    const key = `${lineId}-${personType}-${shift}`;
    if (key in localAttendance) return localAttendance[key];
    const existing = attendance.find((a: any) =>
      a.company_line_id === lineId &&
      a.shift_number === shift &&
      (personType === 'driver' ? a.driver_id !== null : a.supervisor_id !== null)
    );
    return existing ? existing.is_present : false;
  };

  const toggleAttendance = (lineId: string, personType: string, shift: number) => {
    const key = `${lineId}-${personType}-${shift}`;
    setLocalAttendance(prev => ({ ...prev, [key]: !getChecked(lineId, personType, shift) }));
  };

  const handleSave = () => {
    const records: any[] = [];
    lines.forEach((line: any) => {
      for (let shift = 1; shift <= line.number_of_shifts; shift++) {
        if (line.driver) {
          records.push({
            company_line_id: line.id,
            driver_id: line.driver.id,
            attendance_date: selectedDate,
            shift_number: shift,
            shift_rate: line.price_per_shift,
            is_present: getChecked(line.id, 'driver', shift),
          });
        }
        if (line.supervisor) {
          records.push({
            company_line_id: line.id,
            supervisor_id: line.supervisor.id,
            attendance_date: selectedDate,
            shift_number: shift,
            shift_rate: line.price_per_shift,
            is_present: getChecked(line.id, 'supervisor', shift),
          });
        }
      }
    });
    saveAttendanceMutation.mutate(records);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>التاريخ</Label>
          <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setLocalAttendance({}); }} dir="ltr" className="w-44" />
        </div>
        <div className="space-y-2">
          <Label>الشركة</Label>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="كل الشركات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الشركات</SelectItem>
              {companies.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button className="gap-2" onClick={handleSave} disabled={saveAttendanceMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveAttendanceMutation.isPending ? 'جاري الحفظ...' : 'حفظ الحضور'}
          </Button>
        )}
      </div>

      {/* Attendance Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><CalendarDays className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">سجل الحضور - {selectedDate}</h2>
            <p className="text-xs text-muted-foreground">{lines.length} خط</p>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="p-16 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد خطوط</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الشركة</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الخط</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الشخص</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">النوع</TableHead>
                  {[1, 2, 3, 4, 5].map(shift => {
                    const hasShift = lines.some((l: any) => l.number_of_shifts >= shift);
                    if (!hasShift) return null;
                    return (
                      <TableHead key={shift} className="text-xs font-semibold uppercase text-muted-foreground text-center">
                        وردة {shift}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.flatMap((line: any) => {
                  const rows: any[] = [];
                  if (line.driver) {
                    rows.push(
                      <TableRow key={`${line.id}-driver`} className="hover:bg-muted/20">
                        <TableCell className="text-sm text-muted-foreground">{(line as any).company?.name}</TableCell>
                        <TableCell className="font-medium text-sm">{line.name}</TableCell>
                        <TableCell className="text-sm">{line.driver.full_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">سائق</Badge></TableCell>
                        {Array.from({ length: Math.max(...lines.map((l: any) => l.number_of_shifts)) }, (_, i) => i + 1).map(shift => {
                          if (shift > line.number_of_shifts) return <TableCell key={shift} className="text-center text-muted-foreground">-</TableCell>;
                          const checked = getChecked(line.id, 'driver', shift);
                          return (
                            <TableCell key={shift} className="text-center">
                              {canEdit ? (
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleAttendance(line.id, 'driver', shift)}
                                />
                              ) : (
                                checked ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-destructive mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  }
                  if (line.supervisor) {
                    rows.push(
                      <TableRow key={`${line.id}-supervisor`} className="hover:bg-muted/20">
                        <TableCell className="text-sm text-muted-foreground">{(line as any).company?.name}</TableCell>
                        <TableCell className="font-medium text-sm">{line.name}</TableCell>
                        <TableCell className="text-sm">{line.supervisor.full_name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">مشرف</Badge></TableCell>
                        {Array.from({ length: Math.max(...lines.map((l: any) => l.number_of_shifts)) }, (_, i) => i + 1).map(shift => {
                          if (shift > line.number_of_shifts) return <TableCell key={shift} className="text-center text-muted-foreground">-</TableCell>;
                          const checked = getChecked(line.id, 'supervisor', shift);
                          return (
                            <TableCell key={shift} className="text-center">
                              {canEdit ? (
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleAttendance(line.id, 'supervisor', shift)}
                                />
                              ) : (
                                checked ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-destructive mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  }
                  return rows;
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
