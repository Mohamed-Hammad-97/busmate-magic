import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
import { toast } from 'sonner';
import { Plus, Search, Route, Bus, Users, Edit, Eye } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type RouteType = Tables<'routes'>;

const Routes = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null);

  const [formData, setFormData] = useState({
    name: '',
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
          schools (name),
          drivers (full_name),
          supervisors (full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: schools = [] } = useQuery({
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

  const { data: assignmentCounts = {} } = useQuery({
    queryKey: ['route-assignment-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_assignments')
        .select('route_id');
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((a) => {
        counts[a.route_id] = (counts[a.route_id] || 0) + 1;
      });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedRoute) {
        const { error } = await supabase
          .from('routes')
          .update({
            name: formData.name,
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
      toast.success(selectedRoute ? 'تم تحديث الخط بنجاح' : 'تم إضافة الخط بنجاح');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء الحفظ');
      console.error(error);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
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
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.school_id) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    saveMutation.mutate();
  };

  const filteredRoutes = routes.filter((route: any) =>
    route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.schools?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const carTypeLabels: Record<string, string> = {
    ac: 'مكيف',
    non_ac: 'غير مكيف',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">إدارة الخطوط</h1>
            <p className="text-muted-foreground">إدارة خطوط النقل وتعيين السائقين والمشرفين</p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة خط
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الخطوط</CardTitle>
              <Route className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{routes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">الخطوط النشطة</CardTitle>
              <Bus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {routes.filter((r: any) => r.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">السائقين المعينين</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {routes.filter((r: any) => r.driver_id).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الطلاب</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(assignmentCounts).reduce((a, b) => a + b, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو المدرسة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Routes Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم الخط</TableHead>
                  <TableHead className="text-right">المدرسة</TableHead>
                  <TableHead className="text-right">السائق</TableHead>
                  <TableHead className="text-right">المشرف</TableHead>
                  <TableHead className="text-right">نوع السيارة</TableHead>
                  <TableHead className="text-right">المقاعد</TableHead>
                  <TableHead className="text-right">الطلاب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      لا توجد خطوط
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoutes.map((route: any) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-medium">{route.name}</TableCell>
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
                          {route.is_active ? 'نشط' : 'غير نشط'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(route)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedRoute ? 'تعديل الخط' : 'إضافة خط جديد'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الخط *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school">المدرسة *</Label>
                <Select
                  value={formData.school_id}
                  onValueChange={(value) => setFormData({ ...formData, school_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدرسة" />
                  </SelectTrigger>
                  <SelectContent>
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
                  <Label htmlFor="driver">السائق</Label>
                  <Select
                    value={formData.driver_id}
                    onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر السائق" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supervisor">المشرف</Label>
                  <Select
                    value={formData.supervisor_id}
                    onValueChange={(value) => setFormData({ ...formData, supervisor_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المشرف" />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Label htmlFor="car_type">نوع السيارة</Label>
                  <Select
                    value={formData.car_type}
                    onValueChange={(value: 'ac' | 'non_ac') => setFormData({ ...formData, car_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ac">مكيف</SelectItem>
                      <SelectItem value="non_ac">غير مكيف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_seats">عدد المقاعد</Label>
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
                <Label htmlFor="is_active">نشط</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Routes;
