import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, MapPin, Users, Route, Loader2, CheckCircle2, Lightbulb,
  ArrowRight, ArrowLeft, Plus, RefreshCw, Circle, ExternalLink, X,
  Settings2, UserPlus, XCircle, Wand2,
} from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { useCity } from '@/contexts/CityContext';
import RouteMap from '@/components/routes/RouteMap';
import DrawableAreaMap from '@/components/routes/DrawableAreaMap';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import ManageRouteAssignmentsDialog from '@/components/routes/ManageRouteAssignmentsDialog';

interface PolygonPoint { lat: number; lng: number; }
interface SearchArea { points: PolygonPoint[]; }

interface SuggestionStudent {
  id: string;
  student_name: string;
  parent_name: string;
  pickup_order: number;
  lat: number;
  lng: number;
  status: string;
}
interface RouteSuggestion {
  name: string;
  students: SuggestionStudent[];
  estimatedDistance: number;
  studentCount: number;
  pendingFeesCount: number;
}
interface RouteUpdate {
  routeId: string;
  routeName: string;
  currentCount: number;
  maxSeats: number;
  availableSeats: number;
  studentsToAdd: {
    id: string;
    student_name: string;
    parent_name: string;
    lat: number;
    lng: number;
    status: string;
    distance: number;
  }[];
}

const isActiveRegistrationStatus = (status?: string | null) =>
  ['pending_fees', 'complete'].includes((status || '').trim().toLowerCase());

// Distance helper for reordering after edit (Haversine)
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Reorder students starting from furthest-from-school, then nearest-neighbor
function reorderStudents(students: SuggestionStudent[], school?: { latitude: number; longitude: number } | null) {
  if (!school || students.length <= 1) {
    return students.map((s, i) => ({ ...s, pickup_order: i + 1 }));
  }
  const remaining = [...students];
  remaining.sort((a, b) => {
    const da = haversine({ lat: school.latitude, lng: school.longitude }, a);
    const db = haversine({ lat: school.latitude, lng: school.longitude }, b);
    return db - da;
  });
  const ordered: SuggestionStudent[] = [remaining.shift()!];
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(last, remaining[i]);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    ordered.push(remaining.splice(nearestIdx, 1)[0]);
  }
  const totalDistance = ordered.reduce((sum, s, i) =>
    i === 0 ? 0 : sum + haversine(ordered[i - 1], s), 0);
  return { list: ordered.map((s, i) => ({ ...s, pickup_order: i + 1 })), totalDistance };
}

const AIRoutes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'draw' | 'auto' | 'unassigned'>('draw');

  const [selectedRouteCity, setSelectedRouteCity] = useState<string>('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedCarType, setSelectedCarType] = useState<string>('ac');
  const [maxSeats, setMaxSeats] = useState<string>('12');
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [routeUpdates, setRouteUpdates] = useState<RouteUpdate[]>([]);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [routeDirection, setRouteDirection] = useState<'to_school' | 'from_school'>('to_school');
  const [selectedSuggestion, setSelectedSuggestion] = useState<RouteSuggestion | null>(null);
  const [searchArea, setSearchArea] = useState<SearchArea | null>(null);
  const [manageRouteId, setManageRouteId] = useState<string | null>(null);
  const [manageRouteName, setManageRouteName] = useState<string>('');

  const { data: allSchools = [] } = useQuery({
    queryKey: ['schools-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('schools').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const schools = useMemo(() => {
    if (!selectedRouteCity) return allSchools;
    const cityMapping: Record<string, string[]> = {
      cairo: ['cairo', 'القاهرة', 'قاهرة'],
      giza: ['giza', 'الجيزة', 'جيزة'],
      alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
    };
    const cityNames = cityMapping[selectedRouteCity] || [];
    return allSchools.filter((s) =>
      cityNames.some((name) => s.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [allSchools, selectedRouteCity]);

  const selectedSchoolData = useMemo(
    () => schools.find((s) => s.id === selectedSchool),
    [schools, selectedSchool]
  );

  const getGoogleMapsUrl = (suggestion: RouteSuggestion) => {
    if (!selectedSchoolData || suggestion.students.length === 0) return null;
    const sorted = [...suggestion.students].sort((a, b) =>
      routeDirection === 'to_school' ? a.pickup_order - b.pickup_order : b.pickup_order - a.pickup_order
    );
    if (routeDirection === 'to_school') {
      const origin = `${sorted[0].lat},${sorted[0].lng}`;
      const destination = `${selectedSchoolData.latitude},${selectedSchoolData.longitude}`;
      const waypoints = sorted.slice(1).map((s) => `${s.lat},${s.lng}`).join('|');
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
      return url;
    } else {
      const origin = `${selectedSchoolData.latitude},${selectedSchoolData.longitude}`;
      const destination = `${sorted[0].lat},${sorted[0].lng}`;
      const waypoints = sorted.slice(1).map((s) => `${s.lat},${s.lng}`).join('|');
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
      return url;
    }
  };

  // Unassigned pool for current school (used by suggestion editor + Unassigned tab)
  const { data: schoolRegistrations = [], refetch: refetchRegs } = useQuery({
    queryKey: ['school-registrations-active', selectedSchool],
    enabled: !!selectedSchool,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          id, student_name, status,
          parent_accounts ( parent_name, father_phone, pickup_latitude, pickup_longitude, city )
        `)
        .eq('school_id', selectedSchool)
        .in('status', ['pending_fees', 'complete']);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allAssignedIds = [], refetch: refetchAssigned } = useQuery({
    queryKey: ['all-assigned-registration-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.from('route_assignments').select('registration_id');
      if (error) throw error;
      return (data || []).map((a: any) => a.registration_id) as string[];
    },
  });

  const { data: schoolRoutes = [], refetch: refetchRoutes } = useQuery({
    queryKey: ['school-routes', selectedSchool],
    enabled: !!selectedSchool,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, name, max_seats, car_type, is_active, route_assignments(id)')
        .eq('school_id', selectedSchool)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const assignedSet = useMemo(() => new Set(allAssignedIds), [allAssignedIds]);

  const unassignedRegistrations = useMemo(
    () => schoolRegistrations.filter((r: any) => !assignedSet.has(r.id)),
    [schoolRegistrations, assignedSet]
  );

  // Exclude students already present in any current suggestion when offering "add"
  const suggestionUsedIds = useMemo(() => {
    const s = new Set<string>();
    suggestions.forEach((sug) => sug.students.forEach((st) => s.add(st.id)));
    return s;
  }, [suggestions]);

  const availableToAdd = useMemo(
    () => unassignedRegistrations.filter((r: any) => !suggestionUsedIds.has(r.id)),
    [unassignedRegistrations, suggestionUsedIds]
  );

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('*').eq('is_active', true).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['supervisors-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supervisors').select('*').eq('is_active', true).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const useArea = mode === 'draw' && searchArea && searchArea.points.length >= 3;
      const { data, error } = await supabase.functions.invoke('ai-route-planner', {
        body: {
          action: 'suggest-routes',
          schoolId: selectedSchool,
          carType: selectedCarType,
          maxSeatsPerRoute: parseInt(maxSeats),
          searchArea: useArea ? { polygon: searchArea!.points } : null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const activeSuggestions: RouteSuggestion[] = (data.suggestions || [])
        .map((suggestion: RouteSuggestion) => {
          const students = suggestion.students.filter((st) => isActiveRegistrationStatus(st.status));
          return {
            ...suggestion,
            students,
            studentCount: students.length,
            pendingFeesCount: students.filter((s) => s.status === 'pending_fees').length,
          };
        })
        .filter((s: RouteSuggestion) => s.students.length > 0);

      const activeRouteUpdates = (data.routeUpdates || [])
        .map((u: RouteUpdate) => ({
          ...u,
          studentsToAdd: u.studentsToAdd.filter((st) => isActiveRegistrationStatus(st.status)),
        }))
        .filter((u: RouteUpdate) => u.studentsToAdd.length > 0);

      setSuggestions(activeSuggestions);
      setRouteUpdates(activeRouteUpdates);
      setAiInsights(data.aiInsights || '');
      setSelectedSuggestion(null);
      if (activeSuggestions.length === 0 && activeRouteUpdates.length === 0) {
        toast({ title: isRtl ? 'لا يوجد طلاب غير معينين' : 'No unassigned students found' });
      }
    },
    onError: (error: any) =>
      toast({ title: isRtl ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' }),
  });

  const createRouteMutation = useMutation({
    mutationFn: async ({ suggestion }: { suggestion: RouteSuggestion }) => {
      const { data, error } = await supabase.functions.invoke('ai-route-planner', {
        body: {
          action: 'create-suggested-route',
          suggestion,
          schoolId: selectedSchool,
          carType: selectedCarType,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      toast({ title: isRtl ? 'تم إنشاء الخط بنجاح!' : 'Route created successfully!' });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      refetchAssigned();
      refetchRoutes();
      // remove the created suggestion from list
      setSuggestions((prev) => prev.filter((s) => s.name !== vars.suggestion.name));
    },
    onError: (error: any) =>
      toast({ title: isRtl ? 'خطأ في إنشاء الخط' : 'Error creating route', description: error.message, variant: 'destructive' }),
  });

  const addToExistingRouteMutation = useMutation({
    mutationFn: async ({ routeId, students }: { routeId: string; students: RouteUpdate['studentsToAdd'] }) => {
      const { data, error } = await supabase.functions.invoke('ai-route-planner', {
        body: { action: 'add-to-existing-route', routeId, students },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: isRtl ? `تم إضافة ${data.addedCount} طالب` : `Added ${data.addedCount} students` });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      refetchAssigned();
      refetchRoutes();
      suggestMutation.mutate();
    },
    onError: (error: any) =>
      toast({ title: isRtl ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' }),
  });

  // Single-registration -> existing route assignment (Unassigned tab)
  const assignOneMutation = useMutation({
    mutationFn: async ({ registrationId, routeId }: { registrationId: string; routeId: string }) => {
      const { data: currentAssignments } = await supabase
        .from('route_assignments')
        .select('pickup_order')
        .eq('route_id', routeId)
        .order('pickup_order', { ascending: false })
        .limit(1);
      const nextOrder = (currentAssignments?.[0]?.pickup_order || 0) + 1;
      const { error } = await supabase
        .from('route_assignments')
        .insert({ route_id: routeId, registration_id: registrationId, pickup_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: isRtl ? 'تمت الإضافة للخط' : 'Added to route' });
      refetchAssigned();
      refetchRegs();
      refetchRoutes();
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (e: any) =>
      toast({ title: isRtl ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleSuggest = () => {
    if (!selectedRouteCity) return toast({ title: isRtl ? 'يرجى اختيار المدينة' : 'Please select a city', variant: 'destructive' });
    if (!selectedSchool) return toast({ title: isRtl ? 'يرجى اختيار المدرسة' : 'Please select a school', variant: 'destructive' });
    setSuggestions([]);
    setRouteUpdates([]);
    setAiInsights('');
    setSelectedSuggestion(null);
    suggestMutation.mutate();
  };

  const handleRemoveStudent = (sugIdx: number, studentId: string) => {
    setSuggestions((prev) =>
      prev
        .map((sug, i) => {
          if (i !== sugIdx) return sug;
          const remaining = sug.students.filter((s) => s.id !== studentId);
          const reordered = reorderStudents(remaining, selectedSchoolData);
          const list = Array.isArray(reordered) ? reordered : reordered.list;
          const totalDistance = Array.isArray(reordered) ? sug.estimatedDistance : reordered.totalDistance;
          return {
            ...sug,
            students: list,
            studentCount: list.length,
            pendingFeesCount: list.filter((s) => s.status === 'pending_fees').length,
            estimatedDistance: Math.round((totalDistance || 0) * 10) / 10,
          };
        })
        .filter((s) => s.students.length > 0)
    );
  };

  const handleAddStudentToSuggestion = (sugIdx: number, reg: any) => {
    const pa = Array.isArray(reg.parent_accounts) ? reg.parent_accounts[0] : reg.parent_accounts;
    if (!pa?.pickup_latitude || !pa?.pickup_longitude) {
      toast({ title: isRtl ? 'لا يوجد موقع للاستلام' : 'Missing pickup location', variant: 'destructive' });
      return;
    }
    const newStudent: SuggestionStudent = {
      id: reg.id,
      student_name: reg.student_name,
      parent_name: pa.parent_name,
      pickup_order: 0,
      lat: pa.pickup_latitude,
      lng: pa.pickup_longitude,
      status: reg.status,
    };
    setSuggestions((prev) =>
      prev.map((sug, i) => {
        if (i !== sugIdx) return sug;
        const merged = [...sug.students, newStudent];
        const reordered = reorderStudents(merged, selectedSchoolData);
        const list = Array.isArray(reordered) ? reordered : reordered.list;
        const totalDistance = Array.isArray(reordered) ? sug.estimatedDistance : reordered.totalDistance;
        return {
          ...sug,
          students: list,
          studentCount: list.length,
          pendingFeesCount: list.filter((s) => s.status === 'pending_fees').length,
          estimatedDistance: Math.round((totalDistance || 0) * 10) / 10,
        };
      })
    );
  };

  const handleRejectSuggestion = (sugIdx: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== sugIdx));
  };

  const mapRoutes = useMemo(() => {
    return suggestions.map((suggestion, idx) => ({
      id: `suggestion-${idx}`,
      name: suggestion.name,
      students: suggestion.students.map((s) => ({
        id: s.id,
        student_name: s.student_name,
        parent_name: s.parent_name,
        lat: s.lat,
        lng: s.lng,
        pickup_order:
          routeDirection === 'to_school'
            ? s.pickup_order
            : suggestion.students.length - s.pickup_order + 1,
      })),
      school: selectedSchoolData
        ? {
            id: selectedSchoolData.id,
            name: selectedSchoolData.name,
            latitude: selectedSchoolData.latitude,
            longitude: selectedSchoolData.longitude,
          }
        : undefined,
    }));
  }, [suggestions, selectedSchoolData, routeDirection]);

  // -------- UI subcomponents --------

  const CitySchoolPicker = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isRtl ? 'المدينة *' : 'City *'}
        </Label>
        <Select value={selectedRouteCity} onValueChange={(v) => { setSelectedRouteCity(v); setSelectedSchool(''); }}>
          <SelectTrigger className="h-11 rounded-xl bg-background border-border/50">
            <SelectValue placeholder={isRtl ? 'اختر المدينة' : 'Select city'} />
          </SelectTrigger>
          <SelectContent className="bg-background border border-border z-50">
            <SelectItem value="cairo">{isRtl ? 'القاهرة' : 'Cairo'}</SelectItem>
            <SelectItem value="giza">{isRtl ? 'الجيزة' : 'Giza'}</SelectItem>
            <SelectItem value="alexandria">{isRtl ? 'الإسكندرية' : 'Alexandria'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isRtl ? 'المدرسة *' : 'School *'}
        </Label>
        <Select value={selectedSchool} onValueChange={setSelectedSchool} disabled={!selectedRouteCity}>
          <SelectTrigger className="h-11 rounded-xl bg-background border-border/50">
            <SelectValue placeholder={isRtl ? 'اختر المدرسة' : 'Select school'} />
          </SelectTrigger>
          <SelectContent className="bg-background border border-border z-50">
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode !== 'unassigned' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isRtl ? 'نوع السيارة *' : 'Car Type *'}
            </Label>
            <Select value={selectedCarType} onValueChange={setSelectedCarType}>
              <SelectTrigger className="h-11 rounded-xl bg-background border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="ac">{isRtl ? 'مكيف' : 'AC'}</SelectItem>
                <SelectItem value="non_ac">{isRtl ? 'غير مكيف' : 'Non-AC'}</SelectItem>
                <SelectItem value="both">{isRtl ? 'الكل' : 'Both'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isRtl ? 'أقصى عدد مقاعد' : 'Max Seats per Route'}
            </Label>
            <Input
              type="number"
              value={maxSeats}
              onChange={(e) => setMaxSeats(e.target.value)}
              min="4"
              max="50"
              className="h-11 rounded-xl bg-background border-border/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isRtl ? 'اتجاه الخط' : 'Route Direction'}
            </Label>
            <Select value={routeDirection} onValueChange={(v) => setRouteDirection(v as any)}>
              <SelectTrigger className="h-11 rounded-xl bg-background border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="to_school">
                  <div className="flex items-center gap-2"><ArrowRight className="h-4 w-4" />{isRtl ? 'إلى المدرسة' : 'To School'}</div>
                </SelectItem>
                <SelectItem value="from_school">
                  <div className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" />{isRtl ? 'من المدرسة' : 'From School'}</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleSuggest}
              disabled={suggestMutation.isPending}
              className="w-full h-11 rounded-xl font-semibold shadow-md hover:shadow-lg"
            >
              {suggestMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isRtl ? 'جاري التحليل...' : 'Analyzing...'}</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />{isRtl ? 'إنشاء الاقتراحات' : 'Generate Suggestions'}</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const SuggestionResults = () => (
    <>
      {aiInsights && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              {isRtl ? 'رؤى الذكاء الاصطناعي' : 'AI Insights'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiInsights}</p>
          </CardContent>
        </Card>
      )}

      {routeUpdates.length > 0 && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <RefreshCw className="h-5 w-5" />
              {isRtl ? 'خطوط موجودة يمكن إضافة طلاب لها' : 'Existing Routes with Available Capacity'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {routeUpdates.map((update) => (
              <Card key={update.routeId} className="border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{update.routeName}</CardTitle>
                      <CardDescription className="text-xs">
                        {isRtl
                          ? `${update.currentCount}/${update.maxSeats} طالب - يمكن إضافة ${update.availableSeats}`
                          : `${update.currentCount}/${update.maxSeats} students - can add ${update.availableSeats}`}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <Plus className="h-3 w-3 mr-1" />
                      {update.studentsToAdd.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    {update.studentsToAdd.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        <Plus className="h-3 w-3 text-green-600" />
                        <span className="truncate flex-1">{s.student_name || s.parent_name}</span>
                        <span className="text-xs text-muted-foreground">{s.distance} km</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => addToExistingRouteMutation.mutate({ routeId: update.routeId, students: update.studentsToAdd })}
                    disabled={addToExistingRouteMutation.isPending}
                  >
                    {addToExistingRouteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" />{isRtl ? 'تحديث الخط وإضافة الطلاب' : 'Update Route & Add Students'}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {isRtl ? 'خريطة الخطوط المقترحة' : 'Suggested Routes Map'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GoogleMapsProvider>
                <RouteMap
                  routes={mapRoutes}
                  schools={selectedSchoolData ? [{
                    id: selectedSchoolData.id,
                    name: selectedSchoolData.name,
                    latitude: selectedSchoolData.latitude,
                    longitude: selectedSchoolData.longitude,
                  }] : []}
                  selectedRoute={selectedSuggestion ? mapRoutes.find((r) => r.name === selectedSuggestion.name) : null}
                  onRouteClick={(route) => {
                    const s = suggestions.find((x) => x.name === route.name);
                    setSelectedSuggestion(s || null);
                  }}
                  showControls={false}
                  height="500px"
                />
              </GoogleMapsProvider>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              {isRtl ? `خطوط جديدة مقترحة (${suggestions.length})` : `New Route Suggestions (${suggestions.length})`}
            </h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {suggestions.map((suggestion, idx) => (
                <Card
                  key={idx}
                  className={`hover:shadow-md transition-shadow ${
                    selectedSuggestion?.name === suggestion.name ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedSuggestion(suggestion)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{suggestion.studentCount}</Badge>
                        {suggestion.pendingFeesCount > 0 && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            {suggestion.pendingFeesCount} {isRtl ? 'معلق' : 'pending'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      <Route className="h-3 w-3 inline mr-1" />
                      {isRtl ? `تقريباً ${suggestion.estimatedDistance} كم` : `Est. ${suggestion.estimatedDistance} km`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {suggestion.students.map((student) => (
                        <div key={student.id} className="flex items-center gap-2 text-sm group">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0">
                            {routeDirection === 'to_school'
                              ? student.pickup_order
                              : suggestion.students.length - student.pickup_order + 1}
                          </span>
                          <span className="truncate flex-1">{student.student_name || student.parent_name}</span>
                          {student.status === 'pending_fees' && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 px-1">
                              {isRtl ? 'معلق' : 'Pending'}
                            </Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive opacity-60 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); handleRemoveStudent(idx, student.id); }}
                            title={isRtl ? 'إزالة' : 'Remove'}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Add student to suggestion */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={(e) => e.stopPropagation()}
                          disabled={availableToAdd.length === 0}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-2" />
                          {isRtl ? 'إضافة طالب لهذا الخط' : 'Add student to this route'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                        <ScrollArea className="h-64">
                          {availableToAdd.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center p-4">
                              {isRtl ? 'لا يوجد طلاب متاحون' : 'No available students'}
                            </p>
                          ) : (
                            <div className="p-1">
                              {availableToAdd.map((r: any) => {
                                const pa = Array.isArray(r.parent_accounts) ? r.parent_accounts[0] : r.parent_accounts;
                                return (
                                  <button
                                    key={r.id}
                                    className="w-full text-left p-2 text-sm hover:bg-muted rounded flex items-center gap-2"
                                    onClick={() => handleAddStudentToSuggestion(idx, r)}
                                  >
                                    <UserPlus className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="truncate font-medium">{r.student_name || pa?.parent_name}</div>
                                      <div className="truncate text-xs text-muted-foreground">{pa?.parent_name}</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={(e) => { e.stopPropagation(); createRouteMutation.mutate({ suggestion }); }}
                        disabled={createRouteMutation.isPending || suggestion.students.length === 0}
                      >
                        {createRouteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><CheckCircle2 className="h-4 w-4 mr-2" />{isRtl ? 'الموافقة وإنشاء الخط' : 'Approve & Create'}</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleRejectSuggestion(idx); }}
                        title={isRtl ? 'رفض' : 'Reject'}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {isRtl ? 'رفض' : 'Reject'}
                      </Button>
                      {getGoogleMapsUrl(suggestion) && (
                        <a
                          href={getGoogleMapsUrl(suggestion) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 w-10"
                          title={isRtl ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {!suggestMutation.isPending && suggestions.length === 0 && routeUpdates.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {isRtl ? 'لا توجد اقتراحات بعد' : 'No Suggestions Yet'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {isRtl
                ? 'اختر المدرسة ثم اضغط على "إنشاء الاقتراحات".'
                : 'Select a school and click "Generate Suggestions".'}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );

  // ---- Unassigned tab body ----
  const UnassignedTabBody = () => {
    const [perRegRoute, setPerRegRoute] = useState<Record<string, string>>({});
    if (!selectedSchool) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {isRtl ? 'اختر المدينة والمدرسة لعرض الطلاب غير المعينين' : 'Select city and school to view unassigned students'}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unassigned list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {isRtl ? `الطلاب غير المعينين (${unassignedRegistrations.length})` : `Unassigned Students (${unassignedRegistrations.length})`}
            </CardTitle>
            <CardDescription>
              {isRtl
                ? 'اختر الخط المناسب لكل طالب وأضفه إليه'
                : 'Pick the best route for each student and add them'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unassignedRegistrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {isRtl ? 'كل الطلاب معينون بالفعل' : 'All students are already assigned'}
              </p>
            ) : (
              <ScrollArea className="h-[520px] pr-2">
                <div className="space-y-2">
                  {unassignedRegistrations.map((r: any) => {
                    const pa = Array.isArray(r.parent_accounts) ? r.parent_accounts[0] : r.parent_accounts;
                    const chosen = perRegRoute[r.id] || '';
                    return (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
                        <div className="flex-1 min-w-[160px]">
                          <div className="font-medium text-sm truncate">{r.student_name || pa?.parent_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {pa?.parent_name} · {pa?.father_phone}
                          </div>
                        </div>
                        {r.status === 'pending_fees' && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            {isRtl ? 'معلق' : 'Pending'}
                          </Badge>
                        )}
                        <Select
                          value={chosen}
                          onValueChange={(v) => setPerRegRoute((prev) => ({ ...prev, [r.id]: v }))}
                        >
                          <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder={isRtl ? 'اختر خط' : 'Pick route'} />
                          </SelectTrigger>
                          <SelectContent className="bg-background border border-border z-50">
                            {schoolRoutes.length === 0 && (
                              <div className="p-2 text-xs text-muted-foreground">
                                {isRtl ? 'لا توجد خطوط' : 'No routes'}
                              </div>
                            )}
                            {schoolRoutes.map((rt: any) => {
                              const count = rt.route_assignments?.length || 0;
                              const full = count >= rt.max_seats;
                              return (
                                <SelectItem key={rt.id} value={rt.id} disabled={full}>
                                  {rt.name} ({count}/{rt.max_seats}){full ? ' — full' : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => chosen && assignOneMutation.mutate({ registrationId: r.id, routeId: chosen })}
                          disabled={!chosen || assignOneMutation.isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {isRtl ? 'إضافة' : 'Add'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Existing routes with Manage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              {isRtl ? `خطوط المدرسة (${schoolRoutes.length})` : `School Routes (${schoolRoutes.length})`}
            </CardTitle>
            <CardDescription>
              {isRtl ? 'إدارة الطلاب داخل كل خط' : 'Manage students inside each route'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schoolRoutes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {isRtl ? 'لا توجد خطوط بعد' : 'No routes yet'}
              </p>
            ) : (
              <ScrollArea className="h-[520px] pr-2">
                <div className="space-y-2">
                  {schoolRoutes.map((rt: any) => {
                    const count = rt.route_assignments?.length || 0;
                    return (
                      <div key={rt.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{rt.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {count}/{rt.max_seats} · {rt.car_type?.toUpperCase()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setManageRouteId(rt.id); setManageRouteName(rt.name); }}
                        >
                          <Settings2 className="h-4 w-4 mr-1" />
                          {isRtl ? 'إدارة' : 'Manage'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHero
          icon={Sparkles}
          title={isRtl ? 'مخطط الخطوط الذكي' : 'AI Route Planner'}
          description={isRtl
            ? 'ارسم منطقة، اقترح مناطق تلقائياً، أو أضف الطلاب يدوياً لأي خط'
            : 'Draw an area, auto-suggest areas, or manually assign unassigned students'}
        />

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="draw" className="gap-2">
              <Circle className="h-4 w-4" />
              {isRtl ? 'رسم منطقة' : 'Draw Area'}
            </TabsTrigger>
            <TabsTrigger value="auto" className="gap-2">
              <Wand2 className="h-4 w-4" />
              {isRtl ? 'مناطق تلقائية' : 'Auto Areas'}
            </TabsTrigger>
            <TabsTrigger value="unassigned" className="gap-2">
              <Users className="h-4 w-4" />
              {isRtl ? 'غير معينين' : 'Unassigned'}
            </TabsTrigger>
          </TabsList>

          {/* Shared config */}
          <div className="mt-6 relative group">
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-60 blur-[1px]" />
            <div className="relative rounded-2xl border border-border/50 bg-card p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10"><Sparkles className="h-5 w-5 text-primary" /></div>
                  {isRtl ? 'إعدادات الخط' : 'Route Configuration'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === 'unassigned'
                    ? (isRtl ? 'اختر المدرسة لعرض الطلاب غير المعينين' : 'Select a school to view unassigned students')
                    : (isRtl ? 'اختر المدرسة والتفضيلات لإنشاء اقتراحات الخطوط' : 'Select school and preferences to generate route suggestions')}
                </p>
              </div>
              <CitySchoolPicker />
            </div>
          </div>

          <TabsContent value="draw" className="space-y-6 mt-6">
            {selectedSchool && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Circle className="h-5 w-5" />
                    {isRtl ? 'ارسم منطقة البحث' : 'Draw Search Area'}
                  </CardTitle>
                  <CardDescription>
                    {isRtl
                      ? 'ارسم شكلاً على الخريطة لحصر البحث على الطلاب داخل المنطقة'
                      : 'Draw a shape on the map to limit the search to students inside it'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GoogleMapsProvider>
                    <DrawableAreaMap
                      school={selectedSchoolData}
                      searchArea={searchArea}
                      onAreaChange={setSearchArea}
                      height="350px"
                    />
                  </GoogleMapsProvider>
                </CardContent>
              </Card>
            )}
            <SuggestionResults />
          </TabsContent>

          <TabsContent value="auto" className="space-y-6 mt-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4 flex items-start gap-3">
                <Wand2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {isRtl
                    ? 'سنقوم بتحليل جميع نقاط الاستلام للمدرسة المختارة وتقسيمها تلقائياً إلى مناطق مقترحة. راجع كل منطقة ثم وافق أو ارفض.'
                    : "We'll analyze every pickup for the selected school and split them into candidate areas automatically. Review each area and approve or reject."}
                </p>
              </CardContent>
            </Card>
            <SuggestionResults />
          </TabsContent>

          <TabsContent value="unassigned" className="space-y-6 mt-6">
            <UnassignedTabBody />
          </TabsContent>
        </Tabs>
      </div>

      <ManageRouteAssignmentsDialog
        routeId={manageRouteId}
        routeName={manageRouteName}
        schoolId={selectedSchool}
        open={!!manageRouteId}
        onOpenChange={(o) => { if (!o) { setManageRouteId(null); refetchAssigned(); refetchRoutes(); } }}
      />
    </DashboardLayout>
  );
};

export default AIRoutes;
