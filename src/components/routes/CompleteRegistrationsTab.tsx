import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Check, X, Loader2 } from 'lucide-react';

interface Props {
  routes: any[];
  canEdit: boolean;
}

const CompleteRegistrationsTab: React.FC<Props> = ({ routes, canEdit }) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ['complete-registrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          id,
          student_name,
          grade,
          school_id,
          schools ( name ),
          parent_accounts ( parent_name, father_phone, pickup_address )
        `)
        .eq('status', 'complete')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['route-assignments-complete-tab'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_assignments')
        .select('id, route_id, registration_id, pickup_order');
      if (error) throw error;
      return data as any[];
    },
  });

  const assignmentByReg = useMemo(() => {
    const map: Record<string, any> = {};
    assignments.forEach((a) => {
      map[a.registration_id] = a;
    });
    return map;
  }, [assignments]);

  const routeById = useMemo(() => {
    const map: Record<string, any> = {};
    routes.forEach((r) => (map[r.id] = r));
    return map;
  }, [routes]);

  const assignMutation = useMutation({
    mutationFn: async ({ registrationId, routeNumber }: { registrationId: string; routeNumber: number }) => {
      const route = routes.find((r: any) => r.route_number === routeNumber);
      if (!route) throw new Error(isRtl ? 'لا يوجد خط بهذا الرقم' : 'No route with this number');

      const reg = registrations.find((r: any) => r.id === registrationId);
      if (reg && route.school_id !== reg.school_id) {
        throw new Error(isRtl ? 'هذا الخط لمدرسة أخرى' : 'This route belongs to a different school');
      }

      const routeAssignments = assignments.filter((a) => a.route_id === route.id);
      const existing = assignmentByReg[registrationId];
      if (!existing && routeAssignments.length >= (route.max_seats || 0)) {
        throw new Error(isRtl ? 'لا توجد مقاعد متاحة في هذا الخط' : 'No available seats on this route');
      }

      const nextOrder =
        routeAssignments.reduce((m, a) => Math.max(m, a.pickup_order || 0), 0) + 1;

      if (existing) {
        const { error } = await supabase
          .from('route_assignments')
          .update({ route_id: route.id, pickup_order: nextOrder })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('route_assignments')
          .insert({ route_id: route.id, registration_id: registrationId, pickup_order: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      setInputs((p) => ({ ...p, [vars.registrationId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['route-assignments-complete-tab'] });
      queryClient.invalidateQueries({ queryKey: ['route-assignments-with-locations'] });
      toast.success(isRtl ? 'تم إضافة الطالب للخط' : 'Student added to route');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unassignMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from('route_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-assignments-complete-tab'] });
      queryClient.invalidateQueries({ queryKey: ['route-assignments-with-locations'] });
      toast.success(isRtl ? 'تم إزالة الطالب من الخط' : 'Student removed from route');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((r: any) => {
      const pa = Array.isArray(r.parent_accounts) ? r.parent_accounts[0] : r.parent_accounts;
      return (
        (r.student_name || '').toLowerCase().includes(q) ||
        (r.schools?.name || '').toLowerCase().includes(q) ||
        (pa?.parent_name || '').toLowerCase().includes(q) ||
        (pa?.father_phone || '').includes(q)
      );
    });
  }, [registrations, search]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="relative max-w-sm">
          <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
          <Input
            placeholder={isRtl ? 'بحث بالطالب أو المدرسة أو الهاتف...' : 'Search student, school or phone...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={isRtl ? 'pr-10' : 'pl-10'}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'الطالب' : 'Student'}</TableHead>
              <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'ولي الأمر' : 'Parent'}</TableHead>
              <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'المدرسة' : 'School'}</TableHead>
              <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'عنوان الاستلام' : 'Pickup Address'}</TableHead>
              <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'الخط الحالي' : 'Current Route'}</TableHead>
              <TableHead className={isRtl ? 'text-right' : 'text-left'}>{isRtl ? 'رقم الخط' : 'Route Number'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {isRtl ? 'لا توجد تسجيلات مكتملة' : 'No complete registrations'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((reg: any) => {
                const pa = Array.isArray(reg.parent_accounts) ? reg.parent_accounts[0] : reg.parent_accounts;
                const assignment = assignmentByReg[reg.id];
                const currentRoute = assignment ? routeById[assignment.route_id] : null;
                return (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{reg.student_name}</TableCell>
                    <TableCell className="text-sm">
                      <div>{pa?.parent_name}</div>
                      <div className="text-xs text-muted-foreground">{pa?.father_phone}</div>
                    </TableCell>
                    <TableCell className="text-sm">{reg.schools?.name}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate">{pa?.pickup_address || '-'}</TableCell>
                    <TableCell>
                      {currentRoute ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            #{currentRoute.route_number ?? '-'} · {currentRoute.name}
                          </Badge>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => unassignMutation.mutate(assignment.id)}
                              disabled={unassignMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary">{isRtl ? 'غير معين' : 'Unassigned'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            className="h-9 w-24"
                            placeholder={isRtl ? 'رقم' : 'No.'}
                            value={inputs[reg.id] ?? ''}
                            onChange={(e) => setInputs((p) => ({ ...p, [reg.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && inputs[reg.id]) {
                                assignMutation.mutate({
                                  registrationId: reg.id,
                                  routeNumber: Number(inputs[reg.id]),
                                });
                              }
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-primary"
                            disabled={!inputs[reg.id] || assignMutation.isPending}
                            onClick={() =>
                              assignMutation.mutate({
                                registrationId: reg.id,
                                routeNumber: Number(inputs[reg.id]),
                              })
                            }
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default CompleteRegistrationsTab;
