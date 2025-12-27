import React, { useState, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Search, Users, Car, UserCheck, Edit, MapPin } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';

const Staff = () => {
  const queryClient = useQueryClient();
  const { selectedCity } = useCity();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('drivers');
  
  // City mapping for consistent filtering
  const cityMapping: Record<string, string[]> = {
    cairo: ['cairo', 'القاهرة', 'قاهرة', 'Cairo'],
    giza: ['giza', 'الجيزة', 'جيزة', 'Giza'],
    alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية', 'Alexandria'],
  };

  // Driver Dialog State
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [driverForm, setDriverForm] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    city: 'Cairo',
    is_active: true,
  });

  // Supervisor Dialog State
  const [isSupervisorDialogOpen, setIsSupervisorDialogOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<any>(null);
  const [supervisorForm, setSupervisorForm] = useState({
    full_name: '',
    phone: '',
    city: 'Cairo',
    is_active: true,
  });

  const { data: allDrivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: allSupervisors = [], isLoading: supervisorsLoading } = useQuery({
    queryKey: ['supervisors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supervisors')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Filter by global city
  const drivers = useMemo(() => {
    if (selectedCity === 'all') return allDrivers;
    const cityNames = cityMapping[selectedCity] || [];
    return allDrivers.filter((d: any) =>
      cityNames.some((name) => d.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [allDrivers, selectedCity]);

  const supervisors = useMemo(() => {
    if (selectedCity === 'all') return allSupervisors;
    const cityNames = cityMapping[selectedCity] || [];
    return allSupervisors.filter((s: any) =>
      cityNames.some((name) => s.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [allSupervisors, selectedCity]);

  // Driver Mutations
  const saveDriverMutation = useMutation({
    mutationFn: async () => {
      if (selectedDriver) {
        const { error } = await supabase
          .from('drivers')
          .update(driverForm)
          .eq('id', selectedDriver.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('drivers').insert(driverForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success(selectedDriver ? 'تم تحديث السائق بنجاح' : 'تم إضافة السائق بنجاح');
      setIsDriverDialogOpen(false);
      resetDriverForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء الحفظ');
      console.error(error);
    },
  });

  // Supervisor Mutations
  const saveSupervisorMutation = useMutation({
    mutationFn: async () => {
      if (selectedSupervisor) {
        const { error } = await supabase
          .from('supervisors')
          .update(supervisorForm)
          .eq('id', selectedSupervisor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('supervisors').insert(supervisorForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
      toast.success(selectedSupervisor ? 'تم تحديث المشرف بنجاح' : 'تم إضافة المشرف بنجاح');
      setIsSupervisorDialogOpen(false);
      resetSupervisorForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء الحفظ');
      console.error(error);
    },
  });

  const resetDriverForm = () => {
    setDriverForm({ full_name: '', phone: '', license_number: '', city: 'Cairo', is_active: true });
    setSelectedDriver(null);
  };

  const resetSupervisorForm = () => {
    setSupervisorForm({ full_name: '', phone: '', city: 'Cairo', is_active: true });
    setSelectedSupervisor(null);
  };

  const handleEditDriver = (driver: any) => {
    setSelectedDriver(driver);
    setDriverForm({
      full_name: driver.full_name,
      phone: driver.phone,
      license_number: driver.license_number,
      city: driver.city || 'Cairo',
      is_active: driver.is_active,
    });
    setIsDriverDialogOpen(true);
  };

  const handleEditSupervisor = (supervisor: any) => {
    setSelectedSupervisor(supervisor);
    setSupervisorForm({
      full_name: supervisor.full_name,
      phone: supervisor.phone,
      city: supervisor.city || 'Cairo',
      is_active: supervisor.is_active,
    });
    setIsSupervisorDialogOpen(true);
  };

  const filteredDrivers = drivers.filter((d: any) =>
    d.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone.includes(searchTerm)
  );

  const filteredSupervisors = supervisors.filter((s: any) =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة الموظفين</h1>
          <p className="text-muted-foreground">إدارة السائقين والمشرفين</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي السائقين</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{drivers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">السائقين النشطين</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{drivers.filter((d: any) => d.is_active).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المشرفين</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{supervisors.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المشرفين النشطين</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{supervisors.filter((s: any) => s.is_active).length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList>
              <TabsTrigger value="drivers">السائقين</TabsTrigger>
              <TabsTrigger value="supervisors">المشرفين</TabsTrigger>
            </TabsList>
            <Button
              onClick={() => {
                if (activeTab === 'drivers') {
                  resetDriverForm();
                  setIsDriverDialogOpen(true);
                } else {
                  resetSupervisorForm();
                  setIsSupervisorDialogOpen(true);
                }
              }}
            >
              <Plus className="h-4 w-4 ml-2" />
              {activeTab === 'drivers' ? 'إضافة سائق' : 'إضافة مشرف'}
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm mt-4">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>

          <TabsContent value="drivers">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الهاتف</TableHead>
                      <TableHead className="text-right">رقم الرخصة</TableHead>
                      <TableHead className="text-right">المدينة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driversLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : filteredDrivers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          لا يوجد سائقين
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDrivers.map((driver: any) => (
                        <TableRow key={driver.id}>
                          <TableCell className="font-medium">{driver.full_name}</TableCell>
                          <TableCell dir="ltr" className="text-right">{driver.phone}</TableCell>
                          <TableCell>{driver.license_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              {driver.city || 'غير محدد'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={driver.is_active ? 'default' : 'secondary'}>
                              {driver.is_active ? 'نشط' : 'غير نشط'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditDriver(driver)}
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
          </TabsContent>

          <TabsContent value="supervisors">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الهاتف</TableHead>
                      <TableHead className="text-right">المدينة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supervisorsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : filteredSupervisors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          لا يوجد مشرفين
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSupervisors.map((supervisor: any) => (
                        <TableRow key={supervisor.id}>
                          <TableCell className="font-medium">{supervisor.full_name}</TableCell>
                          <TableCell dir="ltr" className="text-right">{supervisor.phone}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              {supervisor.city || 'غير محدد'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={supervisor.is_active ? 'default' : 'secondary'}>
                              {supervisor.is_active ? 'نشط' : 'غير نشط'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSupervisor(supervisor)}
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
          </TabsContent>
        </Tabs>

        {/* Driver Dialog */}
        <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedDriver ? 'تعديل السائق' : 'إضافة سائق جديد'}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!driverForm.full_name || !driverForm.phone || !driverForm.license_number || !driverForm.city) {
                  toast.error('يرجى ملء جميع الحقول المطلوبة');
                  return;
                }
                saveDriverMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="driver_name">الاسم *</Label>
                <Input
                  id="driver_name"
                  value={driverForm.full_name}
                  onChange={(e) => setDriverForm({ ...driverForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver_phone">الهاتف *</Label>
                <Input
                  id="driver_phone"
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_number">رقم الرخصة *</Label>
                <Input
                  id="license_number"
                  value={driverForm.license_number}
                  onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver_city">المدينة *</Label>
                <Select 
                  value={driverForm.city} 
                  onValueChange={(value) => setDriverForm({ ...driverForm, city: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدينة" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="Cairo">القاهرة</SelectItem>
                    <SelectItem value="Giza">الجيزة</SelectItem>
                    <SelectItem value="Alexandria">الإسكندرية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="driver_active">نشط</Label>
                <Switch
                  id="driver_active"
                  checked={driverForm.is_active}
                  onCheckedChange={(checked) => setDriverForm({ ...driverForm, is_active: checked })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDriverDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={saveDriverMutation.isPending}>
                  {saveDriverMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Supervisor Dialog */}
        <Dialog open={isSupervisorDialogOpen} onOpenChange={setIsSupervisorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedSupervisor ? 'تعديل المشرف' : 'إضافة مشرف جديد'}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!supervisorForm.full_name || !supervisorForm.phone || !supervisorForm.city) {
                  toast.error('يرجى ملء جميع الحقول المطلوبة');
                  return;
                }
                saveSupervisorMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="supervisor_name">الاسم *</Label>
                <Input
                  id="supervisor_name"
                  value={supervisorForm.full_name}
                  onChange={(e) => setSupervisorForm({ ...supervisorForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor_phone">الهاتف *</Label>
                <Input
                  id="supervisor_phone"
                  value={supervisorForm.phone}
                  onChange={(e) => setSupervisorForm({ ...supervisorForm, phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor_city">المدينة *</Label>
                <Select 
                  value={supervisorForm.city} 
                  onValueChange={(value) => setSupervisorForm({ ...supervisorForm, city: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدينة" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="Cairo">القاهرة</SelectItem>
                    <SelectItem value="Giza">الجيزة</SelectItem>
                    <SelectItem value="Alexandria">الإسكندرية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="supervisor_active">نشط</Label>
                <Switch
                  id="supervisor_active"
                  checked={supervisorForm.is_active}
                  onCheckedChange={(checked) => setSupervisorForm({ ...supervisorForm, is_active: checked })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsSupervisorDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={saveSupervisorMutation.isPending}>
                  {saveSupervisorMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Staff;
