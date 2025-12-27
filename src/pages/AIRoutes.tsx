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
import { Sparkles, MapPin, Users, Route, Loader2, CheckCircle2, Lightbulb, ArrowRight, ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';
import RouteMap from '@/components/routes/RouteMap';
import type { Tables } from '@/integrations/supabase/types';

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

const AIRoutes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCity, cityLabels } = useCity();

  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedCarType, setSelectedCarType] = useState<string>('ac');
  const [maxSeats, setMaxSeats] = useState<string>('12');
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [routeUpdates, setRouteUpdates] = useState<RouteUpdate[]>([]);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [routeDirection, setRouteDirection] = useState<'to_school' | 'from_school'>('to_school');
  const [selectedSuggestion, setSelectedSuggestion] = useState<RouteSuggestion | null>(null);

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

  // Filter schools by city
  const schools = useMemo(() => {
    if (selectedCity === 'all') return allSchools;
    const cityMapping: Record<string, string[]> = {
      cairo: ['cairo', 'القاهرة', 'قاهرة'],
      giza: ['giza', 'الجيزة', 'جيزة'],
      alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
    };
    const cityNames = cityMapping[selectedCity] || [];
    return allSchools.filter((s) =>
      cityNames.some((name) => s.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [allSchools, selectedCity]);

  const selectedSchoolData = useMemo(() => 
    schools.find(s => s.id === selectedSchool), 
    [schools, selectedSchool]
  );

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
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      setRouteUpdates(data.routeUpdates || []);
      setAiInsights(data.aiInsights || '');
      setSelectedSuggestion(null);
      if (data.suggestions?.length === 0 && data.routeUpdates?.length === 0) {
        toast({ title: isRtl ? 'لا يوجد طلاب غير معينين لهذه المدرسة' : 'No unassigned students found for this school and car type' });
      } else {
        const updateMsg = data.routeUpdates?.length > 0 
          ? (isRtl ? `، ${data.studentsForExistingRoutes} يمكن إضافتهم لخطوط موجودة` : `, ${data.studentsForExistingRoutes} can be added to existing routes`)
          : '';
        toast({ 
          title: isRtl 
            ? `تم العثور على ${data.totalStudents} طالب، مجمعين في ${data.suggestions.length} خطوط جديدة${updateMsg}` 
            : `Found ${data.totalStudents} students, grouped into ${data.suggestions.length} new routes${updateMsg}` 
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
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            {isRtl ? 'مخطط الخطوط الذكي' : 'AI Route Planner'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRtl ? 'تجميع الطلاب وتحسين خطوط التوصيل باستخدام الذكاء الاصطناعي' : 'Automatically group students and optimize pickup routes using AI'}
          </p>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{isRtl ? 'إعدادات الخط' : 'Route Configuration'}</CardTitle>
            <CardDescription>{isRtl ? 'اختر المدرسة والتفضيلات لإنشاء اقتراحات الخطوط' : 'Select school and preferences to generate route suggestions'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label>{isRtl ? 'المدرسة *' : 'School *'}</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label>{isRtl ? 'نوع السيارة' : 'Car Type'}</Label>
                <Select value={selectedCarType} onValueChange={setSelectedCarType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="ac">{isRtl ? 'مكيف' : 'AC'}</SelectItem>
                    <SelectItem value="non_ac">{isRtl ? 'غير مكيف' : 'Non-AC'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{isRtl ? 'أقصى عدد مقاعد' : 'Max Seats per Route'}</Label>
                <Input
                  type="number"
                  value={maxSeats}
                  onChange={(e) => setMaxSeats(e.target.value)}
                  min="4"
                  max="50"
                />
              </div>

              <div className="space-y-2">
                <Label>{isRtl ? 'اتجاه الخط' : 'Route Direction'}</Label>
                <Select value={routeDirection} onValueChange={(v) => setRouteDirection(v as any)}>
                  <SelectTrigger>
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
                <Button onClick={handleSuggest} disabled={suggestMutation.isPending} className="w-full">
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
          </CardContent>
        </Card>

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

                      <Button
                        className="w-full"
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
