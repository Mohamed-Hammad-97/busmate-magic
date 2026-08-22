import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, User, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  routeId: string | null;
  routeName?: string;
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ManageRouteAssignmentsDialog: React.FC<Props> = ({
  routeId,
  routeName,
  schoolId,
  open,
  onOpenChange,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const assignmentsKey = ['route-assignments-manage', routeId];
  const unassignedKey = ['unassigned-registrations-manage', schoolId];

  const { data: assignments = [], isLoading: assignLoading } = useQuery({
    queryKey: assignmentsKey,
    enabled: !!routeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_assignments')
        .select(`
          id,
          pickup_order,
          registration_id,
          registrations (
            id,
            student_name,
            status,
            parent_accounts ( parent_name, father_phone, is_active )
          )
        `)
        .eq('route_id', routeId!)
        .order('pickup_order', { ascending: true });
      if (error) throw error;
      return (data as any[]).filter((a: any) => {
        const reg = a.registrations;
        if (!reg || reg.status === 'cancelled') return false;
        const pa = Array.isArray(reg.parent_accounts) ? reg.parent_accounts[0] : reg.parent_accounts;
        return pa?.is_active !== false;
      });

    },
  });

  const { data: assignedIds = [] } = useQuery({
    queryKey: ['assigned-registration-ids'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('route_assignments').select('registration_id');
      if (error) throw error;
      return (data || []).map((a: any) => a.registration_id) as string[];
    },
  });

  const { data: unassigned = [], isLoading: unassignedLoading } = useQuery({
    queryKey: unassignedKey,
    enabled: !!schoolId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          id,
          student_name,
          status,
          parent_accounts ( parent_name, father_phone )
        `)
        .eq('school_id', schoolId)
        .in('status', ['pending_fees', 'complete']);
      if (error) throw error;
      return data as any[];
    },
  });

  const assignedIdSet = useMemo(() => new Set(assignedIds), [assignedIds]);

  const filteredUnassigned = useMemo(() => {
    const list = unassigned.filter((r) => !assignedIdSet.has(r.id));
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((r: any) => {
      const pa = Array.isArray(r.parent_accounts) ? r.parent_accounts[0] : r.parent_accounts;
      return (
        (r.student_name || '').toLowerCase().includes(q) ||
        (pa?.parent_name || '').toLowerCase().includes(q) ||
        (pa?.father_phone || '').includes(q)
      );
    });
  }, [unassigned, assignedIdSet, search]);

  const addMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const nextOrder = (assignments[assignments.length - 1]?.pickup_order || 0) + 1;
      const { error } = await supabase
        .from('route_assignments')
        .insert({ route_id: routeId!, registration_id: registrationId, pickup_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assignmentsKey });
      qc.invalidateQueries({ queryKey: ['assigned-registration-ids'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: isRtl ? 'تمت إضافة الطالب' : 'Student added' });
    },
    onError: (e: any) =>
      toast({ title: isRtl ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from('route_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assignmentsKey });
      qc.invalidateQueries({ queryKey: ['assigned-registration-ids'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: isRtl ? 'تم حذف الطالب من الخط' : 'Student removed from route' });
    },
    onError: (e: any) =>
      toast({ title: isRtl ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {isRtl ? 'إدارة الخط' : 'Manage Route'} — {routeName}
          </DialogTitle>
          <DialogDescription>
            {isRtl
              ? 'أضف أو احذف الطلاب من هذا الخط.'
              : 'Add or remove students from this route.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 max-h-[65vh]">
          {/* Current assignments */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">
              {isRtl ? 'الطلاب الحاليون' : 'Current Students'} ({assignments.length})
            </h4>
            <ScrollArea className="h-[55vh] rounded-md border p-2">
              {assignLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4" />
              ) : assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isRtl ? 'لا يوجد طلاب' : 'No students yet'}
                </p>
              ) : (
                <div className="space-y-1">
                  {assignments.map((a: any) => {
                    const pa = Array.isArray(a.registrations?.parent_accounts)
                      ? a.registrations.parent_accounts[0]
                      : a.registrations?.parent_accounts;
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 p-2 rounded border bg-card text-sm"
                      >
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0">
                          {a.pickup_order}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">
                            {a.registrations?.student_name || pa?.parent_name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {pa?.parent_name}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeMutation.mutate(a.id)}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Unassigned pool */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">
              {isRtl ? 'الطلاب غير المعينين' : 'Unassigned Students'} ({filteredUnassigned.length})
            </h4>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={isRtl ? 'بحث بالاسم أو الهاتف' : 'Search by name or phone'}
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[48vh] rounded-md border p-2">
              {unassignedLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4" />
              ) : filteredUnassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isRtl ? 'لا يوجد طلاب غير معينين' : 'No unassigned students'}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredUnassigned.map((r: any) => {
                    const pa = Array.isArray(r.parent_accounts)
                      ? r.parent_accounts[0]
                      : r.parent_accounts;
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 p-2 rounded border bg-card text-sm"
                      >
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{r.student_name || pa?.parent_name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {pa?.parent_name} · {pa?.father_phone}
                          </div>
                        </div>
                        {r.status === 'pending_fees' && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            {isRtl ? 'معلق' : 'Pending'}
                          </Badge>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary"
                          onClick={() => addMutation.mutate(r.id)}
                          disabled={addMutation.isPending}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageRouteAssignmentsDialog;
