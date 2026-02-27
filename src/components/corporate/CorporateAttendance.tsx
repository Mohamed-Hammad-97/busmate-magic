import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { CalendarDays, Check, X, Save, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface CorporateAttendanceProps {
  canEdit: boolean;
  staffContext?: 'school' | 'corporate';
}

export function CorporateAttendance({ canEdit, staffContext }: CorporateAttendanceProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedLineId, setSelectedLineId] = useState<string>('all');

  const isSchoolContext = staffContext === 'school';

  // Companies — only for corporate context
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !isSchoolContext,
  });

  // Lines query — differs by context
  const { data: lines = [] } = useQuery({
    queryKey: ['company-lines-for-attendance', selectedCompanyId, selectedLineId, staffContext],
    queryFn: async () => {
      let query = supabase
        .from('company_lines')
        .select(`
          id, name, number_of_shifts, price_per_shift, driver_rate_per_shift, company_id,
          driver:drivers(id, full_name, belongs_to),
          supervisor:supervisors(id, full_name, belongs_to),
          company:companies(id, name)
        `)
        .eq('is_active', true);

      if (isSchoolContext) {
        // For school: no company filter, we filter by driver/supervisor belongs_to after fetch
      } else {
        // Corporate context
        if (selectedCompanyId !== 'all') {
          query = query.eq('company_id', selectedCompanyId);
        }
        if (selectedLineId !== 'all') {
          query = query.eq('id', selectedLineId);
        }
      }

      const { data, error } = await query.order('name');
      if (error) throw error;

      if (isSchoolContext) {
        return (data || []).filter((line: any) => {
          const driverOk = line.driver && (line.driver.belongs_to === 'school' || line.driver.belongs_to === 'both');
          const supervisorOk = line.supervisor && (line.supervisor.belongs_to === 'school' || line.supervisor.belongs_to === 'both');
          return driverOk || supervisorOk;
        });
      }

      return data;
    },
  });

  // All lines for the selected company (for the line dropdown in corporate)
  const { data: companyLines = [] } = useQuery({
    queryKey: ['all-company-lines-dropdown', selectedCompanyId],
    queryFn: async () => {
      if (selectedCompanyId === 'all') return [];
      const { data, error } = await supabase
        .from('company_lines')
        .select('id, name')
        .eq('company_id', selectedCompanyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !isSchoolContext && selectedCompanyId !== 'all',
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
      const lineIds = records.map(r => r.company_line_id);
      await supabase
        .from('corporate_driver_attendance')
        .delete()
        .eq('attendance_date', selectedDate)
        .in('company_line_id', lineIds);

      if (records.length > 0) {
        const { error } = await supabase.from('corporate_driver_attendance').insert(records);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchAttendance();
      toast.success(t('attendance.savedSuccess'));
    },
    onError: () => toast.error(t('attendance.saveError')),
  });

  const [localAttendance, setLocalAttendance] = useState<Record<string, boolean>>({});
  // Extra fees state: key = `${lineId}-${personType}` -> { amount, reason }
  const [localExtraFees, setLocalExtraFees] = useState<Record<string, { amount: number; reason: string }>>({});

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

  const getExtraFee = (lineId: string, personType: string) => {
    const key = `${lineId}-${personType}`;
    if (key in localExtraFees) return localExtraFees[key];
    // Load from existing attendance (extra fee is per-person per-line per-day, stored on shift 1)
    const existing = attendance.find((a: any) =>
      a.company_line_id === lineId &&
      a.shift_number === 1 &&
      (personType === 'driver' ? a.driver_id !== null : a.supervisor_id !== null)
    );
    return {
      amount: existing ? Number(existing.extra_fee_amount || 0) : 0,
      reason: existing?.extra_fee_reason || '',
    };
  };

  const setExtraFee = (lineId: string, personType: string, fee: { amount: number; reason: string }) => {
    const key = `${lineId}-${personType}`;
    setLocalExtraFees(prev => ({ ...prev, [key]: fee }));
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
          const fee = getExtraFee(line.id, 'driver');
          records.push({
            company_line_id: line.id,
            driver_id: line.driver.id,
            attendance_date: selectedDate,
            shift_number: shift,
            shift_rate: line.driver_rate_per_shift || line.price_per_shift,
            is_present: getChecked(line.id, 'driver', shift),
            // Only store extra fee on shift 1 to avoid duplication
            extra_fee_amount: shift === 1 ? (fee.amount || 0) : 0,
            extra_fee_reason: shift === 1 ? (fee.reason || null) : null,
          });
        }
        if (line.supervisor) {
          const fee = getExtraFee(line.id, 'supervisor');
          records.push({
            company_line_id: line.id,
            supervisor_id: line.supervisor.id,
            attendance_date: selectedDate,
            shift_number: shift,
            shift_rate: line.driver_rate_per_shift || line.price_per_shift,
            is_present: getChecked(line.id, 'supervisor', shift),
            extra_fee_amount: shift === 1 ? (fee.amount || 0) : 0,
            extra_fee_reason: shift === 1 ? (fee.reason || null) : null,
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
          <Label>{t('attendance.date')}</Label>
          <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setLocalAttendance({}); setLocalExtraFees({}); }} dir="ltr" className="w-44" />
        </div>

        {!isSchoolContext && (
          <>
            <div className="space-y-2">
              <Label>{t('attendance.company')}</Label>
              <Select value={selectedCompanyId} onValueChange={(v) => { setSelectedCompanyId(v); setSelectedLineId('all'); }}>
                <SelectTrigger className="w-48"><SelectValue placeholder={t('attendance.allCompanies')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('attendance.allCompanies')}</SelectItem>
                  {companies.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCompanyId !== 'all' && companyLines.length > 0 && (
              <div className="space-y-2">
                <Label>{t('attendance.line')}</Label>
                <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                  <SelectTrigger className="w-48"><SelectValue placeholder={t('attendance.allLines')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('attendance.allLines')}</SelectItem>
                    {companyLines.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        {canEdit && (
          <Button className="gap-2" onClick={handleSave} disabled={saveAttendanceMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveAttendanceMutation.isPending ? t('attendance.saving') : t('attendance.saveAttendance')}
          </Button>
        )}
      </div>

      {/* Attendance Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><CalendarDays className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('attendance.record')} - {selectedDate}</h2>
            <p className="text-xs text-muted-foreground">{lines.length} {t('attendance.linesCount')}</p>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="p-16 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('attendance.noLines')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {!isSchoolContext && (
                    <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('attendance.company')}</TableHead>
                  )}
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('attendance.line')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('attendance.person')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('attendance.type')}</TableHead>
                  {[1, 2, 3, 4, 5].map(shift => {
                    const hasShift = lines.some((l: any) => l.number_of_shifts >= shift);
                    if (!hasShift) return null;
                    return (
                      <TableHead key={shift} className="text-xs font-semibold uppercase text-muted-foreground text-center">
                        {t('attendance.shift')} {shift}
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-center">إضافي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.flatMap((line: any) => {
                  const rows: any[] = [];
                  const maxShifts = Math.max(...lines.map((l: any) => l.number_of_shifts));

                  if (line.driver) {
                    const fee = getExtraFee(line.id, 'driver');
                    rows.push(
                      <TableRow key={`${line.id}-driver`} className="hover:bg-muted/20">
                        {!isSchoolContext && (
                          <TableCell className="text-sm text-muted-foreground">{line.company?.name}</TableCell>
                        )}
                        <TableCell className="font-medium text-sm">{line.name}</TableCell>
                        <TableCell className="text-sm">{line.driver.full_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{t('attendance.driver')}</Badge></TableCell>
                        {Array.from({ length: maxShifts }, (_, i) => i + 1).map(shift => {
                          if (shift > line.number_of_shifts) return <TableCell key={shift} className="text-center text-muted-foreground">-</TableCell>;
                          const checked = getChecked(line.id, 'driver', shift);
                          return (
                            <TableCell key={shift} className="text-center">
                              {canEdit ? (
                                <Checkbox checked={checked} onCheckedChange={() => toggleAttendance(line.id, 'driver', shift)} />
                              ) : (
                                checked ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-destructive mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          {canEdit ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant={fee.amount > 0 ? 'default' : 'ghost'} size="sm" className="h-7 gap-1 text-xs">
                                  <DollarSign className="h-3 w-3" />
                                  {fee.amount > 0 ? fee.amount : '+'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 space-y-3" align="end">
                                <p className="text-xs font-semibold text-foreground">رسوم إضافية</p>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">المبلغ</Label>
                                  <Input type="number" className="h-8 text-xs" dir="ltr" value={fee.amount || ''} onChange={(e) => setExtraFee(line.id, 'driver', { ...fee, amount: Number(e.target.value) })} placeholder="0" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">السبب</Label>
                                  <Input className="h-8 text-xs" value={fee.reason} onChange={(e) => setExtraFee(line.id, 'driver', { ...fee, reason: e.target.value })} placeholder="سبب الرسوم..." />
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            fee.amount > 0 ? (
                              <span className="text-xs font-mono text-primary" title={fee.reason}>{fee.amount} ج.م</span>
                            ) : <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (line.supervisor) {
                    const fee = getExtraFee(line.id, 'supervisor');
                    rows.push(
                      <TableRow key={`${line.id}-supervisor`} className="hover:bg-muted/20">
                        {!isSchoolContext && (
                          <TableCell className="text-sm text-muted-foreground">{line.company?.name}</TableCell>
                        )}
                        <TableCell className="font-medium text-sm">{line.name}</TableCell>
                        <TableCell className="text-sm">{line.supervisor.full_name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{t('attendance.supervisor')}</Badge></TableCell>
                        {Array.from({ length: maxShifts }, (_, i) => i + 1).map(shift => {
                          if (shift > line.number_of_shifts) return <TableCell key={shift} className="text-center text-muted-foreground">-</TableCell>;
                          const checked = getChecked(line.id, 'supervisor', shift);
                          return (
                            <TableCell key={shift} className="text-center">
                              {canEdit ? (
                                <Checkbox checked={checked} onCheckedChange={() => toggleAttendance(line.id, 'supervisor', shift)} />
                              ) : (
                                checked ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-destructive mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          {canEdit ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant={fee.amount > 0 ? 'default' : 'ghost'} size="sm" className="h-7 gap-1 text-xs">
                                  <DollarSign className="h-3 w-3" />
                                  {fee.amount > 0 ? fee.amount : '+'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 space-y-3" align="end">
                                <p className="text-xs font-semibold text-foreground">رسوم إضافية</p>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">المبلغ</Label>
                                  <Input type="number" className="h-8 text-xs" dir="ltr" value={fee.amount || ''} onChange={(e) => setExtraFee(line.id, 'supervisor', { ...fee, amount: Number(e.target.value) })} placeholder="0" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">السبب</Label>
                                  <Input className="h-8 text-xs" value={fee.reason} onChange={(e) => setExtraFee(line.id, 'supervisor', { ...fee, reason: e.target.value })} placeholder="سبب الرسوم..." />
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            fee.amount > 0 ? (
                              <span className="text-xs font-mono text-primary" title={fee.reason}>{fee.amount} ج.م</span>
                            ) : <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
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