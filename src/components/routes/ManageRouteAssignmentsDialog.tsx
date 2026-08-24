import React, { useEffect, useMemo, useState } from 'react';
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
import {
  Loader2,
  Plus,
  Trash2,
  User,
  Search,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Save,
  RotateCcw,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { suggestPickupOrder, totalRouteDistanceKm } from '@/lib/routeOrder';

interface Props {
  routeId: string | null;
  routeName?: string;
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrderItem {
  id: string; // assignment id
  registrationId: string;
  studentName: string;
  parentName: string;
  lat: number | null;
  lng: number | null;
}

const SortableRow: React.FC<{
  item: OrderItem;
  index: number;
  suggestedIndex?: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  removing: boolean;
  isFirst: boolean;
  isLast: boolean;
  isRtl: boolean;
}> = ({ item, index, suggestedIndex, onMove, onRemove, removing, isFirst, isLast, isRtl }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded border bg-card text-sm"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
        aria-label={isRtl ? 'إعادة الترتيب' : 'Reorder'}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{item.studentName || item.parentName}</div>
        <div className="truncate text-xs text-muted-foreground">
          {item.parentName}
          {item.lat == null || item.lng == null ? (
            <span className="ms-1 inline-flex items-center gap-1 text-orange-600">
              <AlertTriangle className="h-3 w-3" />
              {isRtl ? 'لا يوجد موقع' : 'No location'}
            </span>
          ) : null}
        </div>
      </div>
      {suggestedIndex !== undefined && suggestedIndex !== index && (
        <Badge variant="outline" className="text-[10px] text-primary border-primary/40 shrink-0">
          {index + 1} → {suggestedIndex + 1}
        </Badge>
      )}
      <div className="flex flex-col">
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-6"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label={isRtl ? 'تحريك لأعلى' : 'Move up'}
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-6"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label={isRtl ? 'تحريك لأسفل' : 'Move down'}
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={onRemove}
        disabled={removing}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const ManageRouteAssignmentsDialog: React.FC<Props> = ({
  routeId,
  routeName,
  schoolId,
  open,
  onOpenChange,
}) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [suggestion, setSuggestion] = useState<OrderItem[] | null>(null);

  const assignmentsKey = ['route-assignments-manage', routeId];
  const unassignedKey = ['unassigned-registrations-manage', schoolId];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
            parent_accounts ( parent_name, father_phone, pickup_latitude, pickup_longitude )
          )
        `)
        .eq('route_id', routeId!)
        .order('pickup_order', { ascending: true });
      if (error) throw error;
      return (data || []).filter((a: any) => a.registrations && a.registrations.status !== 'cancelled') as any[];
    },
  });

  const { data: school } = useQuery({
    queryKey: ['route-school-coords', schoolId],
    enabled: !!schoolId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('latitude, longitude')
        .eq('id', schoolId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Sync fetched assignments into the local editable order (unless there are unsaved edits)
  useEffect(() => {
    if (dirty) return;
    setOrder(
      assignments.map((a: any) => {
        const pa = Array.isArray(a.registrations?.parent_accounts)
          ? a.registrations.parent_accounts[0]
          : a.registrations?.parent_accounts;
        return {
          id: a.id,
          registrationId: a.registration_id,
          studentName: a.registrations?.student_name || '',
          parentName: pa?.parent_name || '',
          lat: pa?.pickup_latitude ?? null,
          lng: pa?.pickup_longitude ?? null,
        };
      })
    );
  }, [assignments, dirty]);

  useEffect(() => {
    if (!open) {
      setDirty(false);
      setSuggestion(null);
      setSearch('');
    }
  }, [open]);

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

  const suggestedIndexById = useMemo(() => {
    if (!suggestion) return undefined;
    const map: Record<string, number> = {};
    suggestion.forEach((s, i) => (map[s.id] = i));
    return map;
  }, [suggestion]);

  const currentDistance = useMemo(
    () => totalRouteDistanceKm(order, school?.latitude, school?.longitude),
    [order, school]
  );
  const suggestedDistance = useMemo(
    () => (suggestion ? totalRouteDistanceKm(suggestion, school?.latitude, school?.longitude) : 0),
    [suggestion, school]
  );

  const addMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const nextOrder = order.length + 1;
      const { error } = await supabase
        .from('route_assignments')
        .insert({ route_id: routeId!, registration_id: registrationId, pickup_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      setSuggestion(null);
      qc.invalidateQueries({ queryKey: assignmentsKey });
      qc.invalidateQueries({ queryKey: ['assigned-registration-ids'] });
      qc.invalidateQueries({ queryKey: ['registration-route-numbers'] });
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
      setDirty(false);
      setSuggestion(null);
      qc.invalidateQueries({ queryKey: assignmentsKey });
      qc.invalidateQueries({ queryKey: ['assigned-registration-ids'] });
      qc.invalidateQueries({ queryKey: ['registration-route-numbers'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: isRtl ? 'تم حذف الطالب من الخط' : 'Student removed from route' });
    },
    onError: (e: any) =>
      toast({ title: isRtl ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveOrderMutation = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < order.length; i++) {
        const { error } = await supabase
          .from('route_assignments')
          .update({ pickup_order: i + 1 })
          .eq('id', order[i].id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setDirty(false);
      setSuggestion(null);
      qc.invalidateQueries({ queryKey: assignmentsKey });
      qc.invalidateQueries({ queryKey: ['routes'] });
      qc.invalidateQueries({ queryKey: ['route-assignments-with-locations'] });
      qc.invalidateQueries({ queryKey: ['route-assignments-all'] });
      qc.invalidateQueries({ queryKey: ['route-students'] });
      toast({ title: isRtl ? 'تم حفظ الترتيب' : 'Order saved' });
    },
    onError: (e: any) =>
      toast({ title: isRtl ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((o) => o.id === active.id);
    const newIndex = order.findIndex((o) => o.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
    setDirty(true);
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    setOrder(arrayMove(order, index, target));
    setDirty(true);
  };

  const handleSuggest = () => {
    const s = suggestPickupOrder(
      order.map((o) => ({ ...o })),
      school?.latitude,
      school?.longitude
    );
    setSuggestion(s as OrderItem[]);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    setOrder(suggestion);
    setSuggestion(null);
    setDirty(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {isRtl ? 'إدارة الخط' : 'Manage Route'} — {routeName}
          </DialogTitle>
          <DialogDescription>
            {isRtl
              ? 'أضف أو احذف الطلاب، واسحب لإعادة ترتيب نقاط التحميل.'
              : 'Add or remove students, and drag to reorder pickup stops.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 max-h-[65vh]">
          {/* Current assignments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                {isRtl ? 'الطلاب الحاليون' : 'Current Students'} ({order.length})
              </h4>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={handleSuggest}
                disabled={order.length < 2}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isRtl ? 'اقتراح أفضل ترتيب' : 'Suggest best order'}
              </Button>
            </div>

            {suggestion && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {isRtl ? 'المسافة الحالية' : 'Current distance'}:{' '}
                  <span className="font-semibold text-foreground">
                    {currentDistance.toFixed(1)} km
                  </span>{' '}
                  · {isRtl ? 'المقترح' : 'Suggested'}:{' '}
                  <span className="font-semibold text-primary">
                    {suggestedDistance.toFixed(1)} km
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={applySuggestion}>
                    <Check className="h-3.5 w-3.5" />
                    {isRtl ? 'تطبيق الاقتراح' : 'Apply suggestion'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => setSuggestion(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                    {isRtl ? 'تجاهل' : 'Dismiss'}
                  </Button>
                </div>
              </div>
            )}

            {dirty && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => saveOrderMutation.mutate()}
                  disabled={saveOrderMutation.isPending}
                >
                  {saveOrderMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {isRtl ? 'حفظ الترتيب' : 'Save order'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1"
                  onClick={() => {
                    setDirty(false);
                    setSuggestion(null);
                  }}
                  disabled={saveOrderMutation.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {isRtl ? 'إلغاء التغييرات' : 'Reset'}
                </Button>
              </div>
            )}

            <ScrollArea className="h-[50vh] rounded-md border p-2">
              {assignLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4" />
              ) : order.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isRtl ? 'لا يوجد طلاب' : 'No students yet'}
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={order.map((o) => o.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {order.map((item, index) => (
                        <SortableRow
                          key={item.id}
                          item={item}
                          index={index}
                          suggestedIndex={suggestedIndexById?.[item.id]}
                          onMove={(dir) => move(index, dir)}
                          onRemove={() => removeMutation.mutate(item.id)}
                          removing={removeMutation.isPending}
                          isFirst={index === 0}
                          isLast={index === order.length - 1}
                          isRtl={isRtl}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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
