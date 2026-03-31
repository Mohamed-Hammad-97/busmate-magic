import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from 'sonner';
import { Settings as SettingsIcon, Users, Globe, Plus, Edit, Search, Archive, AlertTriangle } from 'lucide-react';
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
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { PageHero } from '@/components/layout/PageHero';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Employee = Tables<'employees'>;
type Department = Enums<'department'>;

const departmentLabels: Record<Department, { en: string; ar: string }> = {
  customer_support: { en: 'Customer Support', ar: 'دعم العملاء' },
  operations: { en: 'Operations (Schools)', ar: 'عمليات (مدارس)' },
  operation_companies: { en: 'Operations (Companies)', ar: 'عمليات (شركات)' },
  finance: { en: 'Finance', ar: 'المالية' },
  reports: { en: 'Reports', ar: 'التقارير' },
};

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    departments: [] as Department[],
    is_active: true,
    user_id: '',
    password: '',
    city: '',
  });

  const archiveYearMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('archive-school-year', {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(
        isRtl
          ? `تم أرشفة السنة الدراسية بنجاح - ${data.stats.registrations_archived} تسجيل`
          : `School year archived successfully - ${data.stats.registrations_archived} registrations archived`
      );
      setIsArchiveDialogOpen(false);
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error archiving school year');
    },
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data as Employee[];
    },
  });

  const saveEmployeeMutation = useMutation({
    mutationFn: async () => {
      if (selectedEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from('employees')
          .update({
            full_name: employeeForm.full_name,
            email: employeeForm.email,
            phone: employeeForm.phone,
            departments: employeeForm.departments,
            is_active: employeeForm.is_active,
            city: employeeForm.city || null,
          })
          .eq('id', selectedEmployee.id);
        if (error) throw error;
      } else {
        // Create new employee via edge function
        if (!employeeForm.password || employeeForm.password.length < 6) {
          throw new Error(i18n.language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
        }
        
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await supabase.functions.invoke('create-employee', {
          body: {
            email: employeeForm.email,
            full_name: employeeForm.full_name,
            phone: employeeForm.phone,
            departments: employeeForm.departments,
            password: employeeForm.password,
            city: employeeForm.city || null,
          },
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data?.error) {
          throw new Error(response.data.error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(selectedEmployee ? t('common.save') : t('settings.addEmployee'));
      setIsEmployeeDialogOpen(false);
      resetEmployeeForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error saving employee');
      console.error(error);
    },
  });

  const resetEmployeeForm = () => {
    setEmployeeForm({
      full_name: '',
      email: '',
      phone: '',
      departments: [],
      is_active: true,
      user_id: '',
      password: '',
      city: '',
    });
    setSelectedEmployee(null);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEmployeeForm({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || '',
      departments: employee.departments as Department[],
      is_active: employee.is_active,
      user_id: employee.user_id,
      password: '',
      city: (employee as any).city || '',
    });
    setIsEmployeeDialogOpen(true);
  };

  const toggleDepartment = (dept: Department) => {
    setEmployeeForm(prev => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter(d => d !== dept)
        : [...prev.departments, dept],
    }));
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isRtl = i18n.language === 'ar';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHero
          icon={SettingsIcon}
          title={t('settings.title')}
          description={t('settings.description')}
          stats={[
            { icon: Users, value: employees.length, label: 'Employees' },
          ]}
        />

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              {t('settings.general')}
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="employees" className="gap-2">
                <Users className="h-4 w-4" />
                {t('settings.employees')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t('settings.languageSettings')}
                </CardTitle>
                <CardDescription>{t('settings.selectLanguage')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('common.language')}</p>
                    <p className="text-sm text-muted-foreground">
                      {isRtl ? 'اختر لغة واجهة النظام' : 'Select system interface language'}
                    </p>
                  </div>
                  <LanguageSwitcher />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('settings.employeeManagement')}</CardTitle>
                    <CardDescription>
                      {isRtl ? 'إدارة حسابات الموظفين وصلاحياتهم' : 'Manage employee accounts and permissions'}
                    </CardDescription>
                  </div>
                  {isSuperAdmin && (
                    <Button onClick={() => { resetEmployeeForm(); setIsEmployeeDialogOpen(true); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('settings.addEmployee')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-sm">
                  <Search className={`absolute top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRtl ? 'right-3' : 'left-3'}`} />
                  <Input
                    placeholder={t('common.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={isRtl ? 'pr-10' : 'pl-10'}
                  />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={isRtl ? 'text-right' : ''}>{t('common.name')}</TableHead>
                      <TableHead className={isRtl ? 'text-right' : ''}>{t('common.email')}</TableHead>
                      <TableHead className={isRtl ? 'text-right' : ''}>{t('common.phone')}</TableHead>
                      <TableHead className={isRtl ? 'text-right' : ''}>{t('common.city')}</TableHead>
                      <TableHead className={isRtl ? 'text-right' : ''}>{t('settings.departments')}</TableHead>
                      <TableHead className={isRtl ? 'text-right' : ''}>{t('common.status')}</TableHead>
                      <TableHead className={isRtl ? 'text-right' : ''}>{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                       <TableCell colSpan={7} className="text-center py-8">
                          {t('common.loading')}
                        </TableCell>
                      </TableRow>
                    ) : filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          {t('common.noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.full_name}</TableCell>
                          <TableCell>{employee.email}</TableCell>
                          <TableCell dir="ltr" className={isRtl ? 'text-right' : ''}>{employee.phone || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{(employee as any).city || 'All'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {employee.departments.map((dept) => (
                                <Badge key={dept} variant="outline" className="text-xs">
                                  {departmentLabels[dept as Department]?.[i18n.language as 'en' | 'ar'] || dept}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                              {employee.is_active ? t('common.active') : t('common.inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEmployee(employee)}
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
          )}
        </Tabs>

        {/* Employee Dialog */}
        <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedEmployee ? t('settings.editEmployee') : t('settings.addEmployee')}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!employeeForm.full_name || !employeeForm.email) {
                  toast.error(isRtl ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
                  return;
                }
                saveEmployeeMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="emp_name">{t('common.name')} *</Label>
                <Input
                  id="emp_name"
                  value={employeeForm.full_name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp_email">{t('common.email')} *</Label>
                <Input
                  id="emp_email"
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp_phone">{t('common.phone')}</Label>
                <Input
                  id="emp_phone"
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                />
              </div>
              {!selectedEmployee && (
                <div className="space-y-2">
                  <Label htmlFor="emp_password">{isRtl ? 'كلمة المرور' : 'Password'} *</Label>
                  <Input
                    id="emp_password"
                    type="password"
                    value={employeeForm.password}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                    placeholder={isRtl ? '6 أحرف على الأقل' : 'At least 6 characters'}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="emp_city">{t('common.city')}</Label>
                <Select value={employeeForm.city} onValueChange={(val) => setEmployeeForm({ ...employeeForm, city: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRtl ? 'اختر المدينة' : 'Select city'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cairo">{isRtl ? 'القاهرة' : 'Cairo'}</SelectItem>
                    <SelectItem value="giza">{isRtl ? 'الجيزة' : 'Giza'}</SelectItem>
                    <SelectItem value="alexandria">{isRtl ? 'الإسكندرية' : 'Alexandria'}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? 'اترك فارغاً للوصول لكل المدن' : 'Leave empty for access to all cities'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.departments')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(departmentLabels) as Department[]).map((dept) => (
                    <div key={dept} className="flex items-center space-x-2">
                      <Checkbox
                        id={dept}
                        checked={employeeForm.departments.includes(dept)}
                        onCheckedChange={() => toggleDepartment(dept)}
                      />
                      <label htmlFor={dept} className="text-sm cursor-pointer">
                        {departmentLabels[dept][i18n.language as 'en' | 'ar']}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="emp_active">{t('common.active')}</Label>
                <Switch
                  id="emp_active"
                  checked={employeeForm.is_active}
                  onCheckedChange={(checked) => setEmployeeForm({ ...employeeForm, is_active: checked })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEmployeeDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saveEmployeeMutation.isPending}>
                  {saveEmployeeMutation.isPending ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
