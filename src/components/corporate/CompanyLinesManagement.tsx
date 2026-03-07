import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowRight, Plus, Edit, Truck, Clock, DollarSign, Users, MapPin,
} from 'lucide-react';

interface CompanyLinesManagementProps {
  company: any;
  onBack: () => void;
  canEdit: boolean;
  hideBackButton?: boolean;
}

export function CompanyLinesManagement({ company, onBack, canEdit, hideBackButton }: CompanyLinesManagementProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<any>(null);
  const [lineForm, setLineForm] = useState({
    name: '', number_of_shifts: 1, shift_times: [''] as string[], route_details: '',
    price_per_shift: 0, driver_rate_per_shift: 0, driver_id: '', supervisor_id: '', notes: '', is_active: true,
  });

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['company-lines', company.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_lines').select(`*, driver:drivers(id, full_name, phone), supervisor:supervisors(id, full_name, phone)`).eq('company_id', company.id).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['corporate-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('id, full_name, phone, belongs_to').eq('is_active', true).in('belongs_to', ['corporate', 'both']).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['corporate-supervisors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supervisors').select('id, full_name, phone, belongs_to').eq('is_active', true).in('belongs_to', ['corporate', 'both']).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const saveLineMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: company.id, name: lineForm.name, number_of_shifts: lineForm.number_of_shifts,
        shift_times: lineForm.shift_times.filter(t2 => t2), route_details: lineForm.route_details || null,
        price_per_shift: lineForm.price_per_shift, driver_rate_per_shift: lineForm.driver_rate_per_shift,
        driver_id: lineForm.driver_id || null, supervisor_id: lineForm.supervisor_id || null,
        notes: lineForm.notes || null, is_active: lineForm.is_active,
      };
      if (selectedLine) {
        const { error } = await supabase.from('company_lines').update(payload).eq('id', selectedLine.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('company_lines').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-lines', company.id] });
      queryClient.invalidateQueries({ queryKey: ['company-lines-count'] });
      toast.success(selectedLine ? t('corporateMgmt.lineUpdated') : t('corporateMgmt.lineAdded'));
      setLineDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error(t('corporateMgmt.error')),
  });

  const resetForm = () => {
    setLineForm({ name: '', number_of_shifts: 1, shift_times: [''], route_details: '', price_per_shift: 0, driver_rate_per_shift: 0, driver_id: '', supervisor_id: '', notes: '', is_active: true });
    setSelectedLine(null);
  };

  const handleEdit = (line: any) => {
    setSelectedLine(line);
    const shiftTimes = Array.isArray(line.shift_times) ? line.shift_times : [''];
    setLineForm({
      name: line.name, number_of_shifts: line.number_of_shifts,
      shift_times: shiftTimes.length > 0 ? shiftTimes : [''], route_details: line.route_details || '',
      price_per_shift: line.price_per_shift, driver_rate_per_shift: line.driver_rate_per_shift || 0,
      driver_id: line.driver_id || '', supervisor_id: line.supervisor_id || '',
      notes: line.notes || '', is_active: line.is_active,
    });
    setLineDialogOpen(true);
  };

  const updateShiftCount = (count: number) => {
    const newTimes = [...lineForm.shift_times];
    while (newTimes.length < count) newTimes.push('');
    setLineForm({ ...lineForm, number_of_shifts: count, shift_times: newTimes.slice(0, count) });
  };

  const updateShiftTime = (index: number, value: string) => {
    const newTimes = [...lineForm.shift_times];
    newTimes[index] = value;
    setLineForm({ ...lineForm, shift_times: newTimes });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {!hideBackButton && (
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={onBack}>
            <ArrowRight className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{t('corporateMgmt.manageLines')}</p>
        </div>
        {canEdit && (
          <Button className="gap-2 mr-auto" onClick={() => { resetForm(); setLineDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            {t('corporateMgmt.addLine')}
          </Button>
        )}
      </div>

      {/* Company Info Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{company.city}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{company.contact_person_name}</span>
          </div>
          <div className="flex items-center gap-2" dir="ltr">
            <span className="text-muted-foreground">{company.contact_person_phone}</span>
          </div>
          <div>
            <Badge variant="outline">{lines.length} {t('corporateMgmt.lines')}</Badge>
          </div>
        </div>
      </div>

      {/* Lines Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><Truck className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('corporateMgmt.companyLines')}</h2>
            <p className="text-xs text-muted-foreground">{lines.length} {t('attendance.linesCount')}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-16 text-center"><p className="text-sm text-muted-foreground">{t('corporateMgmt.loading')}</p></div>
        ) : lines.length === 0 ? (
          <div className="p-16 text-center">
            <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('corporateMgmt.noLines')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.lineName')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.shiftsCount')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.shiftTimes')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.invoiceRate')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.driverRate')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.driver')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.supervisor')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.status')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">{t('corporateMgmt.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line: any) => (
                  <TableRow key={line.id} className="group hover:bg-muted/20 transition-colors duration-150">
                    <TableCell className="font-medium text-sm">{line.name}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono">{line.number_of_shifts}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(line.shift_times) ? line.shift_times : []).map((time: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs"><Clock className="h-3 w-3 ml-1" />{time || '-'}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-muted-foreground" /><span className="text-sm font-mono">{line.price_per_shift}</span></div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-muted-foreground" /><span className="text-sm font-mono">{line.driver_rate_per_shift || 0}</span></div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{line.driver?.full_name || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{line.supervisor?.full_name || '-'}</TableCell>
                    <TableCell>
                      {line.is_active ? (
                        <div className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20">{t('corporateMgmt.active')}</div>
                      ) : (
                        <div className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border/50">{t('corporateMgmt.inactive')}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleEdit(line)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add/Edit Line Dialog */}
      <Dialog open={lineDialogOpen} onOpenChange={(open) => { setLineDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedLine ? t('corporateMgmt.editLine') : t('corporateMgmt.addNewLine')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('corporateMgmt.lineName')} *</Label>
              <Input value={lineForm.name} onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })} placeholder={t('corporateMgmt.lineExample')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('corporateMgmt.shiftsCount')} *</Label>
                <Select value={String(lineForm.number_of_shifts)} onValueChange={(v) => updateShiftCount(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('corporateMgmt.invoiceRate')} *</Label>
                <Input type="number" value={lineForm.price_per_shift} onChange={(e) => setLineForm({ ...lineForm, price_per_shift: Number(e.target.value) })} placeholder="0" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('corporateMgmt.driverRate')} *</Label>
                <Input type="number" value={lineForm.driver_rate_per_shift} onChange={(e) => setLineForm({ ...lineForm, driver_rate_per_shift: Number(e.target.value) })} placeholder="0" dir="ltr" />
              </div>
              <div></div>
            </div>
            <div className="space-y-2">
              <Label>{t('corporateMgmt.shiftTimes')}</Label>
              <div className="space-y-2">
                {lineForm.shift_times.map((time, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">{t('corporateMgmt.shiftLabel')} {i + 1}</Badge>
                    <Input type="time" value={time} onChange={(e) => updateShiftTime(i, e.target.value)} dir="ltr" />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('corporateMgmt.routeDetails')}</Label>
              <Textarea value={lineForm.route_details} onChange={(e) => setLineForm({ ...lineForm, route_details: e.target.value })} placeholder={t('corporateMgmt.routePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('corporateMgmt.driver')}</Label>
                <Select value={lineForm.driver_id || 'none'} onValueChange={(v) => setLineForm({ ...lineForm, driver_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder={t('corporateMgmt.selectDriver')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('corporateMgmt.noDriver')}</SelectItem>
                    {drivers.map((d: any) => (<SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('corporateMgmt.supervisor')}</Label>
                <Select value={lineForm.supervisor_id || 'none'} onValueChange={(v) => setLineForm({ ...lineForm, supervisor_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder={t('corporateMgmt.selectSupervisor')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('corporateMgmt.noSupervisor')}</SelectItem>
                    {supervisors.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('corporateMgmt.notes')}</Label>
              <Textarea value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} placeholder={t('corporateMgmt.notes') + '...'} />
            </div>
            {selectedLine && (
              <div className="flex items-center gap-2">
                <Switch checked={lineForm.is_active} onCheckedChange={(v) => setLineForm({ ...lineForm, is_active: v })} />
                <Label>{t('corporateMgmt.active')}</Label>
              </div>
            )}
            <Button className="w-full" onClick={() => {
              if (!lineForm.name || lineForm.price_per_shift <= 0 || lineForm.driver_rate_per_shift <= 0) {
                toast.error(t('corporateMgmt.fillLineFields'));
                return;
              }
              saveLineMutation.mutate();
            }} disabled={saveLineMutation.isPending}>
              {saveLineMutation.isPending ? t('corporateMgmt.saving') : selectedLine ? t('corporateMgmt.update') : t('common.add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
