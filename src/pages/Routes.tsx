import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Search, Route, Bus, Users, Edit, Map, School, Trash2, ExternalLink } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCity } from '@/contexts/CityContext';
import RouteMap from '@/components/routes/RouteMap';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import type { Tables } from '@/integrations/supabase/types';
import CompleteRegistrationsTab from '@/components/routes/CompleteRegistrationsTab';
import RouteStudentsDialog from '@/components/routes/RouteStudentsDialog';

type RouteType = Tables<'routes'>;

const Routes = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const { isSuperAdmin, hasDepartment } = useAuth();
  const canEdit = isSuperAdmin || hasDepartment('operations');
  const { selectedCity } = useCity();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'map' | 'complete'>('table');
  const [mapSelectedRoute, setMapSelectedRoute] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<RouteType | null>(null);
  const [studentsRoute, setStudentsRoute] = useState<any | null>(null);


  const [formData, setFormData] = useState({
    name: '',
    route_number: '' as string,
    school_id: '',
    driver_id: '',
    supervisor_id: '',
    car_type: 'ac' as 'ac' | 'non_ac',
    max_seats: 14,
    is_active: true,
  });

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          schools (id, name, city, latitude, longitude),
          drivers (full_name),
          supervisors (full_name)
        `)
        .order('route_number', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const nextRouteNumber = useMemo(() => {
    const max = routes.reduce((m: number, r: any) => Math.max(m, r.route_number || 0), 0);
    return max + 1;
  }, [routes]);

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

  // Filter routes by city
  const cityFilteredRoutes = useMemo(() => {
    if (selectedCity === 'all') return routes;
    const cityMapping: Record<string, string[]> = {
      cairo: ['cairo', 'القاهرة', 'قاهرة'],
      giza: ['giza', 'الجيزة', 'جيزة'],
      alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
    };
    const cityNames = cityMapping[selectedCity] || [];
    return routes.filter((r: any) =>
      cityNames.some((name) => r.schools?.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [routes, selectedCity]);

  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .in('belongs_to', ['school', 'both'])
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: allSupervisors = [] } = useQuery({
    queryKey: ['supervisors-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supervisors')
        .select('*')
        .eq('is_active', true)
        .in('belongs_to', ['school', 'both'])
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Filter drivers and supervisors by selected city
  const drivers = useMemo(() => {
    if (selectedCity === 'all') return allDrivers;
    const cityMapping: Record<string, string[]> = {
      cairo: ['cairo', 'القاهرة', 'قاهرة'],
      giza: ['giza', 'الجيزة', 'جيزة'],
      alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
    };
    const cityNames = cityMapping[selectedCity] || [];
    return allDrivers.filter((d) =>
      cityNames.some((name) => d.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [allDrivers, selectedCity]);

  const supervisors = useMemo(() => {
    if (selectedCity === 'all') return allSupervisors;
    const cityMapping: Record<string, string[]> = {
      cairo: ['cairo', 'القاهرة', 'قاهرة'],
      giza: ['giza', 'الجيزة', 'جيزة'],
      alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
    };
    const cityNames = cityMapping[selectedCity] || [];
    return allSupervisors.filter((s) =>
      cityNames.some((name) => s.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [allSupervisors, selectedCity]);

  const { data: routeAssignments = [] } = useQuery({
    queryKey: ['route-assignments-with-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_assignments')
        .select(`
          *,
          registrations (
            id,
            student_name,
            parent_accounts (
              id,
              parent_name,
              pickup_latitude,
              pickup_longitude
            )
          )
        `);
      if (error) throw error;
      return data;
    },
  });

  const assignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    routeAssignments.forEach((a: any) => {
      counts[a.route_id] = (counts[a.route_id] || 0) + 1;
    });
    return counts;
  }, [routeAssignments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedRoute) {
        const { error } = await supabase
          .from('routes')
          .update({
            name: formData.name,
            route_number: formData.route_number ? Number(formData.route_number) : null,
            school_id: formData.school_id,
            driver_id: formData.driver_id || null,
            supervisor_id: formData.supervisor_id || null,
            car_type: formData.car_type,
            max_seats: formData.max_seats,
            is_active: formData.is_active,
          })
          .eq('id', selectedRoute.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('routes')
          .insert({
            name: formData.name,
            route_number: formData.route_number ? Number(formData.route_number) : nextRouteNumber,
            school_id: formData.school_id,
            driver_id: formData.driver_id || null,
            supervisor_id: formData.supervisor_id || null,
            car_type: formData.car_type,
            max_seats: formData.max_seats,
            is_active: formData.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success(selectedRoute 
        ? (isRtl ? 'تم تحديث الخط بنجاح' : 'Route updated successfully')
        : (isRtl ? 'تم إضافة الخط بنجاح' : 'Route added successfully')
      );
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(isRtl ? 'حدث خطأ أثناء الحفظ' : 'Error saving route');
      console.error(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      // First, delete all route assignments (this unassigns students)
      const { error: assignmentsError } = await supabase
        .from('route_assignments')
        .delete()
        .eq('route_id', routeId);
      if (assignmentsError) throw assignmentsError;

      // Then delete the route itself
      const { error: routeError } = await supabase
        .from('routes')
        .delete()
        .eq('id', routeId);
      if (routeError) throw routeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['route-assignments-with-locations'] });
      toast.success(isRtl ? 'تم حذف الخط وإلغاء تعيين الطلاب بنجاح' : 'Route deleted and students unassigned successfully');
      setDeleteDialogOpen(false);
      setRouteToDelete(null);
    },
    onError: (error) => {
      toast.error(isRtl ? 'حدث خطأ أثناء حذف الخط' : 'Error deleting route');
      console.error(error);
    },
  });

  const handleDeleteClick = (route: RouteType) => {
    setRouteToDelete(route);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (routeToDelete) {
      deleteMutation.mutate(routeToDelete.id);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      route_number: '',
      school_id: '',
      driver_id: '',
      supervisor_id: '',
      car_type: 'ac',
      max_seats: 14,
      is_active: true,
    });
    setSelectedRoute(null);
  };

  const handleEdit = (route: RouteType) => {
    setSelectedRoute(route);
    setFormData({
      name: route.name,
      route_number: (route as any).route_number ? String((route as any).route_number) : '',
      school_id: route.school_id,
      driver_id: route.driver_id || '',
      supervisor_id: route.supervisor_id || '',
      car_type: route.car_type,
      max_seats: route.max_seats,
      is_active: route.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, route_number: String(nextRouteNumber) }));
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.school_id) {
      toast.error(isRtl ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }
    saveMutation.mutate();
  };

  const filteredRoutes = cityFilteredRoutes.filter((route: any) =>
    route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(route.route_number ?? '').includes(searchTerm.trim()) ||
    route.schools?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const carTypeLabels: Record<string, string> = {
    ac: isRtl ? 'مكيف' : 'AC',
    non_ac: isRtl ? 'غير مكيف' : 'Non-AC',
  };

  // Prepare data for map
  const mapSchools = useMemo(() => {
    const schoolMap: Record<string, { id: string; name: string; latitude: number; longitude: number }> = {};
    filteredRoutes.forEach((r: any) => {
      if (r.schools && !schoolMap[r.schools.id]) {
        schoolMap[r.schools.id] = {
          id: r.schools.id,
          name: r.schools.name,
          latitude: r.schools.latitude,
          longitude: r.schools.longitude,
        };
      }
    });
    return Object.values(schoolMap);
  }, [filteredRoutes]);

  const mapStudents = useMemo(() => {
    const students: any[] = [];
    routeAssignments.forEach((a: any) => {
      if (a.registrations?.parent_accounts) {
        const pa = a.registrations.parent_accounts;
        students.push({
          id: a.registration_id,
          student_name: a.registrations.student_name,
          parent_name: pa.parent_name,
          lat: pa.pickup_latitude,
          lng: pa.pickup_longitude,
          pickup_order: a.pickup_order,
        });
      }
    });
    return students;
  }, [routeAssignments]);

  const mapRoutes = useMemo(() => {
    return filteredRoutes.map((route: any) => {
      const routeStudents = routeAssignments
        .filter((a: any) => a.route_id === route.id)
        .map((a: any) => ({
          id: a.registration_id,
          student_name: a.registrations?.student_name || '',
          parent_name: a.registrations?.parent_accounts?.parent_name || '',
          lat: a.registrations?.parent_accounts?.pickup_latitude,
          lng: a.registrations?.parent_accounts?.pickup_longitude,
          pickup_order: a.pickup_order,
        }))
        .filter((s: any) => s.lat && s.lng);

      return {
        id: route.id,
        name: route.name,
        students: routeStudents,
        school: route.schools ? {
          id: route.schools.id,
          name: route.schools.name,
          latitude: route.schools.latitude,
          longitude: route.schools.longitude,
        } : undefined,
      };
    });
  }, [filteredRoutes, routeAssignments]);

  // Generate Google Maps URL for a route
  const getGoogleMapsUrl = (route: any) => {
    const routeData = mapRoutes.find((r) => r.id === route.id);
    if (!routeData || !routeData.school || routeData.students.length === 0) return null;

    const sortedStudents = [...routeData.students].sort((a, b) => 
      (a.pickup_order || 0) - (b.pickup_order || 0)
    );

    // First student is origin, school is destination
    const origin = `${sortedStudents[0].lat},${sortedStudents[0].lng}`;
    const destination = `${routeData.school.latitude},${routeData.school.longitude}`;
    const waypoints = sortedStudents.slice(1).map((s) => `${s.lat},${s.lng}`).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    if (waypoints) {
      url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }
    return url;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHero
          icon={Route}
          title={isRtl ? 'إدارة الخطوط' : 'Routes Management'}
          description={isRtl ? 'إدارة خطوط النقل وتعيين السائقين والمشرفين' : 'Manage transportation routes, assign drivers and supervisors'}
          stats={[
            { icon: Route, value: filteredRoutes.length, label: isRtl ? 'إجمالي الخطوط' : 'Total Routes' },
            { icon: Bus, value: filteredRoutes.filter((r: any) => r.is_active).length, label: isRtl ? 'نشطة' : 'Active' },
            { icon: Users, value: filteredRoutes.filter((r: any) => r.driver_id).length, label: isRtl ? 'سائقين' : 'Drivers' },
            { icon: Users, value: filteredRoutes.reduce((sum: number, r: any) => sum + (assignmentCounts[r.id] || 0), 0), label: isRtl ? 'طلاب' : 'Students' },
          ]}
          actions={
            canEdit && (
              <Button className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm" onClick={handleAddNew}>
                <Plus className="h-4 w-4" />
                {isRtl ? 'إضافة خط' : 'Add Route'}
              </Button>
            )
          }
        />

        {/* Tabs for Table/Map view */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="table">
                {isRtl ? 'جدول' : 'Table'}
              </TabsTrigger>
              <TabsTrigger value="map">
                <Map className="h-4 w-4 mr-2" />
                {isRtl ? 'خريطة' : 'Map'}
              </TabsTrigger>
              <TabsTrigger value="complete">
                {isRtl ? 'التسجيلات المكتملة' : 'Complete Registrations'}
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <div className="relative max-w-sm">
              <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
              <Input
                placeholder={isRtl ? 'بحث بالاسم أو المدرسة...' : 'Search by name or school...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={isRtl ? 'pr-10' : 'pl-10'}
              />
            </div>
          </div>

          <TabsContent value="table" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'رقم الخط' : 'Route No.'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'اسم الخط' : 'Route Name'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'المدرسة' : 'School'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'السائق' : 'Driver'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'المشرف' : 'Supervisor'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'نوع السيارة' : 'Car Type'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'المقاعد' : 'Seats'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'الطلاب' : 'Students'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'الحالة' : 'Status'}
                      </TableHead>
                      <TableHead className={isRtl ? 'text-right' : 'text-left'}>
                        {isRtl ? 'الإجراءات' : 'Actions'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          {isRtl ? 'جاري التحميل...' : 'Loading...'}
                        </TableCell>
                      </TableRow>
                    ) : filteredRoutes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          {isRtl ? 'لا توجد خطوط' : 'No routes found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRoutes.map((route: any) => (
                        <TableRow
                          key={route.id}
                          className="cursor-pointer"
                          onClick={() => setStudentsRoute(route)}
                        >
                          <TableCell>
                            <Badge variant="outline" className="font-semibold">#{route.route_number ?? '-'}</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-primary hover:underline">{route.name}</TableCell>
                          <TableCell>{route.schools?.name}</TableCell>
                          <TableCell>{route.drivers?.full_name || '-'}</TableCell>
                          <TableCell>{route.supervisors?.full_name || '-'}</TableCell>
                          <TableCell>{carTypeLabels[route.car_type]}</TableCell>
                          <TableCell>{route.max_seats}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {assignmentCounts[route.id] || 0} / {route.max_seats}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={route.is_active ? 'default' : 'secondary'}>
                              {route.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(route)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {getGoogleMapsUrl(route) && (
                                <a
                                  href={getGoogleMapsUrl(route) || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 w-9"
                                  title={isRtl ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              {isSuperAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(route)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  {isRtl ? 'خريطة الخطوط' : 'Routes Map'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GoogleMapsProvider>
                  <RouteMap
                    students={mapStudents}
                    schools={mapSchools}
                    routes={mapRoutes}
                    selectedRoute={mapSelectedRoute}
                    onRouteClick={(route) => setMapSelectedRoute(route)}
                    showControls={true}
                    height="600px"
                  />
                </GoogleMapsProvider>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="complete" className="mt-4">
            <CompleteRegistrationsTab routes={routes} canEdit={canEdit} />
          </TabsContent>
        </Tabs>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedRoute 
                  ? (isRtl ? 'تعديل الخط' : 'Edit Route')
                  : (isRtl ? 'إضافة خط جديد' : 'Add New Route')
                }
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{isRtl ? 'اسم الخط *' : 'Route Name *'}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="route_number">{isRtl ? 'رقم الخط *' : 'Route Number *'}</Label>
                <Input
                  id="route_number"
                  type="number"
                  min={1}
                  value={formData.route_number}
                  onChange={(e) => setFormData({ ...formData, route_number: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school">{isRtl ? 'المدرسة *' : 'School *'}</Label>
                <Select
                  value={formData.school_id}
                  onValueChange={(value) => setFormData({ ...formData, school_id: value })}
                >
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="driver">{isRtl ? 'السائق' : 'Driver'}</Label>
                  <Select
                    value={formData.driver_id}
                    onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRtl ? 'اختر السائق' : 'Select driver'} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supervisor">{isRtl ? 'المشرف' : 'Supervisor'}</Label>
                  <Select
                    value={formData.supervisor_id}
                    onValueChange={(value) => setFormData({ ...formData, supervisor_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRtl ? 'اختر المشرف' : 'Select supervisor'} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {supervisors.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {supervisor.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="car_type">{isRtl ? 'نوع السيارة' : 'Car Type'}</Label>
                  <Select
                    value={formData.car_type}
                    onValueChange={(value: 'ac' | 'non_ac') => setFormData({ ...formData, car_type: value })}
                  >
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
                  <Label htmlFor="max_seats">{isRtl ? 'عدد المقاعد' : 'Max Seats'}</Label>
                  <Input
                    id="max_seats"
                    type="number"
                    min="1"
                    value={formData.max_seats}
                    onChange={(e) => setFormData({ ...formData, max_seats: parseInt(e.target.value) || 14 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">{isRtl ? 'نشط' : 'Active'}</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending 
                    ? (isRtl ? 'جاري الحفظ...' : 'Saving...')
                    : (isRtl ? 'حفظ' : 'Save')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isRtl ? 'هل أنت متأكد من حذف هذا الخط؟' : 'Are you sure you want to delete this route?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isRtl 
                  ? `سيتم حذف الخط "${routeToDelete?.name}" وإلغاء تعيين جميع الطلاب المسجلين فيه (${assignmentCounts[routeToDelete?.id || ''] || 0} طالب). سيظهر هؤلاء الطلاب مرة أخرى في اقتراحات إنشاء الخطوط بالذكاء الاصطناعي.`
                  : `The route "${routeToDelete?.name}" will be deleted and all assigned students (${assignmentCounts[routeToDelete?.id || ''] || 0} students) will be unassigned. These students will appear again in the AI route generation suggestions.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending 
                  ? (isRtl ? 'جاري الحذف...' : 'Deleting...')
                  : (isRtl ? 'حذف' : 'Delete')
                }
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Routes;
