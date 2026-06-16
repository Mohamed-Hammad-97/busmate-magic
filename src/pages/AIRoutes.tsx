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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, MapPin, Users, Route, Loader2, CheckCircle2, Lightbulb, ArrowRight, ArrowLeft, Plus, RefreshCw, Circle, ExternalLink } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { useCity } from '@/contexts/CityContext';
import RouteMap from '@/components/routes/RouteMap';
import DrawableAreaMap from '@/components/routes/DrawableAreaMap';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import type { Tables } from '@/integrations/supabase/types';

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface SearchArea {
  points: PolygonPoint[];
}

interface RouteSuggestion {
  name: string;
  students: {
    id: string;
    student_name: string;
    parent_name: string;
    pickup_order: number;
    lat: number;
    lng: number;
    status: string;
  }[];
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

const AIRoutes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCity, cityLabels } = useCity();

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

  const { data: allSchools = [] } = useQuery({
    queryKey: ['schools-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Filter schools by selected route city
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

  const selectedSchoolData = useMemo(() => 
    schools.find(s => s.id === selectedSchool), 
    [schools, selectedSchool]
  );

  // Generate Google Maps URL for a suggestion
  const getGoogleMapsUrl = (suggestion: RouteSuggestion) => {
    if (!selectedSchoolData || suggestion.students.length === 0) return null;
    
    const sortedStudents = [...suggestion.students].sort((a, b) => 
      routeDirection === 'to_school' ? a.pickup_order - b.pickup_order : b.pickup_order - a.pickup_order
    );
    
    if (routeDirection === 'to_school') {
      // First student is origin, school is destination
      const origin = `${sortedStudents[0].lat},${sortedStudents[0].lng}`;
      const destination = `${selectedSchoolData.latitude},${selectedSchoolData.longitude}`;
      const waypoints = sortedStudents.slice(1).map(s => `${s.lat},${s.lng}`).join('|');
      
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      if (waypoints) {
        url += `&waypoints=${encodeURIComponent(waypoints)}`;
      }
      return url;
    } else {
      // School is origin, first student (reversed order) is destination
      const origin = `${selectedSchoolData.latitude},${selectedSchoolData.longitude}`;
      const destination = `${sortedStudents[0].lat},${sortedStudents[0].lng}`;
      const waypoints = sortedStudents.slice(1).map(s => `${s.lat},${s.lng}`).join('|');
      
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      if (waypoints) {
        url += `&waypoints=${encodeURIComponent(waypoints)}`;
      }
      return url;
    }
  };

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['supervisors-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supervisors')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-route-planner', {
        body: {
          action: 'suggest-routes',
          schoolId: selectedSchool,
          carType: selectedCarType,
          maxSeatsPerRoute: parseInt(maxSeats),
          searchArea: searchArea && searchArea.points.length >= 3 ? {
            polygon: searchArea.points,
          } : null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const activeSuggestions = (data.suggestions || [])
        .map((suggestion: RouteSuggestion) => {
          const students = suggestion.students.filter((student) => isActiveRegistrationStatus(student.status));
          return {
            ...suggestion,
            students,
            studentCount: students.length,
            pendingFeesCount: students.filter((student) => student.status === 'pending_fees').length,
          };
        })
        .filter((suggestion: RouteSuggestion) => suggestion.students.length > 0);

      const activeRouteUpdates = (data.routeUpdates || [])
        .map((update: RouteUpdate) => ({
          ...update,
          studentsToAdd: update.studentsToAdd.filter((student) => isActiveRegistrationStatus(student.status)),
        }))
        .filter((update: RouteUpdate) => update.studentsToAdd.length > 0);

      setSuggestions(activeSuggestions);
      setRouteUpdates(activeRouteUpdates);
      setAiInsights(data.aiInsights || '');
      setSelectedSuggestion(null);
      if (activeSuggestions.length === 0 && activeRouteUpdates.length === 0) {
        toast({ title: isRtl ? 'لا يوجد طلاب غير معينين لهذه المدرسة' : 'No unassigned students found for this school and car type' });
      } else {
        const studentsForExistingRoutes = activeRouteUpdates.reduce((sum, update) => sum + update.studentsToAdd.length, 0);
        const totalStudents = activeSuggestions.reduce((sum, suggestion) => sum + suggestion.students.length, 0) + studentsForExistingRoutes;
        const updateMsg = activeRouteUpdates.length > 0 
          ? (isRtl ? `، ${studentsForExistingRoutes} يمكن إضافتهم لخطوط موجودة` : `, ${studentsForExistingRoutes} can be added to existing routes`)
          : '';
        toast({ 
          title: isRtl 
            ? `تم العثور على ${totalStudents} طالب، مجمعين في ${activeSuggestions.length} خطوط جديدة${updateMsg}` 
            : `Found ${totalStudents} students, grouped into ${activeSuggestions.length} new routes${updateMsg}` 
        });
      }
    },
    onError: (error: any) => {
      toast({ title: isRtl ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: async ({ suggestion, driverId, supervisorId }: { 
      suggestion: RouteSuggestion; 
      driverId?: string;
      supervisorId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-route-planner', {
        body: {
          action: 'create-suggested-route',
          suggestion,
          schoolId: selectedSchool,
          carType: selectedCarType,
          driverId,
          supervisorId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: isRtl ? 'تم إنشاء الخط بنجاح!' : 'Route created successfully!' });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      suggestMutation.mutate();
    },
    onError: (error: any) => {
      toast({ title: isRtl ? 'خطأ في إنشاء الخط' : 'Error creating route', description: error.message, variant: 'destructive' });
    },
  });

  const addToExistingRouteMutation = useMutation({
    mutationFn: async ({ routeId, students }: { routeId: string; students: RouteUpdate['studentsToAdd'] }) => {
      const { data, error } = await supabase.functions.invoke('ai-route-planner', {
        body: {
          action: 'add-to-existing-route',
          routeId,
          students,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: isRtl ? `تم إضافة ${data.addedCount} طالب للخط بنجاح!` : `Successfully added ${data.addedCount} students to route!` });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      suggestMutation.mutate();
    },
    onError: (error: any) => {
      toast({ title: isRtl ? 'خطأ في إضافة الطلاب' : 'Error adding students', description: error.message, variant: 'destructive' });
    },
  });

  const handleSuggest = () => {
    if (!selectedRouteCity) {
      toast({ title: isRtl ? 'يرجى اختيار المدينة' : 'Please select a city', variant: 'destructive' });
      return;
    }
    if (!selectedSchool) {
      toast({ title: isRtl ? 'يرجى اختيار المدرسة' : 'Please select a school', variant: 'destructive' });
      return;
    }
    setSuggestions([]);
    setRouteUpdates([]);
    setAiInsights('');
    setSelectedSuggestion(null);
    suggestMutation.mutate();
  };

  // Prepare map data
  const mapRoutes = useMemo(() => {
    return suggestions.map((suggestion, idx) => ({
      id: `suggestion-${idx}`,
      name: suggestion.name,
      students: suggestion.students.map(s => ({
        id: s.id,
        student_name: s.student_name,
        parent_name: s.parent_name,
        lat: s.lat,
        lng: s.lng,
        pickup_order: routeDirection === 'to_school' ? s.pickup_order : (suggestion.students.length - s.pickup_order + 1),
      })),
      school: selectedSchoolData ? {
        id: selectedSchoolData.id,
        name: selectedSchoolData.name,
        latitude: selectedSchoolData.latitude,
        longitude: selectedSchoolData.longitude,
      } : undefined,
    }));
  }, [suggestions, selectedSchoolData, routeDirection]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHero
          icon={Sparkles}
          title={isRtl ? 'مخطط الخطوط الذكي' : 'AI Route Planner'}
          description={isRtl ? 'تجميع الطلاب وتحسين خطوط التوصيل باستخدام الذكاء الاصطناعي' : 'Automatically group students and optimize pickup routes using AI'}
        />

        {/* Configuration */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-60 group-hover:opacity-100 transition-opacity duration-500 blur-[1px]" />
          <div className="relative rounded-2xl border border-border/50 bg-card p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                {isRtl ? 'إعدادات الخط' : 'Route Configuration'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{isRtl ? 'اختر المدرسة والتفضيلات لإنشاء اقتراحات الخطوط' : 'Select school and preferences to generate route suggestions'}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isRtl ? 'المدينة *' : 'City *'}</Label>
                <Select value={selectedRouteCity} onValueChange={(v) => { setSelectedRouteCity(v); setSelectedSchool(''); }}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border/50 focus:border-primary/50">
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isRtl ? 'المدرسة *' : 'School *'}</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool} disabled={!selectedRouteCity}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border/50 focus:border-primary/50">
                    <SelectValue placeholder={isRtl ? 'اختر المدرسة' : 'Select school'} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isRtl ? 'نوع السيارة *' : 'Car Type *'}</Label>
                <Select value={selectedCarType} onValueChange={setSelectedCarType}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border/50 focus:border-primary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="ac">{isRtl ? 'مكيف' : 'AC'}</SelectItem>
                    <SelectItem value="non_ac">{isRtl ? 'غير مكيف' : 'Non-AC'}</SelectItem>
                    <SelectItem value="both">{isRtl ? 'الكل' : 'Both'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isRtl ? 'أقصى عدد مقاعد' : 'Max Seats per Route'}</Label>
                <Input
                  type="number"
                  value={maxSeats}
                  onChange={(e) => setMaxSeats(e.target.value)}
                  min="4"
                  max="50"
                  className="h-11 rounded-xl bg-background border-border/50 focus:border-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isRtl ? 'اتجاه الخط' : 'Route Direction'}</Label>
                <Select value={routeDirection} onValueChange={(v) => setRouteDirection(v as any)}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border/50 focus:border-primary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="to_school">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" />
                        {isRtl ? 'إلى المدرسة' : 'To School'}
                      </div>
                    </SelectItem>
                    <SelectItem value="from_school">
                      <div className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        {isRtl ? 'من المدرسة' : 'From School'}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={handleSuggest} disabled={suggestMutation.isPending} className="w-full h-11 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all">
                  {suggestMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isRtl ? 'جاري التحليل...' : 'Analyzing...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isRtl ? 'إنشاء الاقتراحات' : 'Generate Suggestions'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Search Area Map */}
        {selectedSchool && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Circle className="h-5 w-5" />
                {isRtl ? 'تحديد منطقة البحث (اختياري)' : 'Define Search Area (Optional)'}
              </CardTitle>
              <CardDescription>
                {isRtl 
                  ? 'ارسم دائرة على الخريطة لتحديد المنطقة التي تريد البحث فيها عن الطلاب' 
                  : 'Draw a circle on the map to limit the search to students in that area'}
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

        {/* AI Insights */}
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

        {/* Existing Routes with Available Capacity */}
        {routeUpdates.length > 0 && (
          <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <RefreshCw className="h-5 w-5" />
                {isRtl ? 'خطوط موجودة يمكن إضافة طلاب لها' : 'Existing Routes with Available Capacity'}
              </CardTitle>
              <CardDescription>
                {isRtl 
                  ? 'هؤلاء الطلاب قريبون من خطوط موجودة ويمكن إضافتهم إليها' 
                  : 'These students are near existing routes and can be added to them'}
              </CardDescription>
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
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <Plus className="h-3 w-3 mr-1" />
                        {update.studentsToAdd.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      {update.studentsToAdd.map((student) => (
                        <div key={student.id} className="flex items-center gap-2 text-sm">
                          <Plus className="h-3 w-3 text-green-600" />
                          <span className="truncate flex-1">{student.student_name || student.parent_name}</span>
                          <span className="text-xs text-muted-foreground">{student.distance} km</span>
                          {student.status === 'pending_fees' && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 px-1">
                              {isRtl ? 'معلق' : 'Pending'}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => addToExistingRouteMutation.mutate({ 
                        routeId: update.routeId, 
                        students: update.studentsToAdd 
                      })}
                      disabled={addToExistingRouteMutation.isPending}
                    >
                      {addToExistingRouteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {isRtl ? 'تحديث الخط وإضافة الطلاب' : 'Update Route & Add Students'}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Map and New Route Suggestions */}
        {suggestions.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Map */}
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
                    selectedRoute={selectedSuggestion ? mapRoutes.find(r => r.name === selectedSuggestion.name) : null}
                    onRouteClick={(route) => {
                      const suggestion = suggestions.find(s => s.name === route.name);
                      setSelectedSuggestion(suggestion || null);
                    }}
                    showControls={false}
                    height="500px"
                  />
                </GoogleMapsProvider>
              </CardContent>
            </Card>

            {/* New Route Suggestions List */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">
                {isRtl ? `خطوط جديدة مقترحة (${suggestions.length})` : `New Route Suggestions (${suggestions.length})`}
              </h2>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {suggestions.map((suggestion, idx) => (
                  <Card
                    key={idx}
                    className={`hover:shadow-md transition-shadow cursor-pointer ${
                      selectedSuggestion?.name === suggestion.name ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedSuggestion(suggestion)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="secondary">
                            <Users className="h-3 w-3 mr-1" />
                            {suggestion.studentCount}
                          </Badge>
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
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {suggestion.students.map((student, sIdx) => (
                          <div key={student.id} className="flex items-center gap-2 text-sm">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                              {routeDirection === 'to_school' ? student.pickup_order : (suggestion.students.length - student.pickup_order + 1)}
                            </span>
                            <span className="truncate flex-1">{student.student_name || student.parent_name}</span>
                            {student.status === 'pending_fees' && (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 px-1">
                                {isRtl ? 'معلق' : 'Pending'}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            createRouteMutation.mutate({ suggestion });
                          }}
                          disabled={createRouteMutation.isPending}
                        >
                          {createRouteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {isRtl ? 'إنشاء الخط' : 'Create Route'}
                            </>
                          )}
                        </Button>
                        {getGoogleMapsUrl(suggestion) && (
                          <a
                            href={getGoogleMapsUrl(suggestion) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10"
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

        {/* Empty state */}
        {!suggestMutation.isPending && suggestions.length === 0 && routeUpdates.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {isRtl ? 'لا توجد اقتراحات خطوط بعد' : 'No Route Suggestions Yet'}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                {isRtl
                  ? 'اختر مدرسة واضغط على "إنشاء الاقتراحات" للسماح للذكاء الاصطناعي بتحليل مواقع الطلاب وإنشاء خطوط محسنة.'
                  : 'Select a school and click "Generate Suggestions" to let AI analyze student locations and create optimized routes.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AIRoutes;
