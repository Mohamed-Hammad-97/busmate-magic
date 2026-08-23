import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Search, Users, Car, UserCheck, Edit, MapPin, KeyRound, TrendingUp, CreditCard } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';
import { useAuth } from '@/contexts/AuthContext';
import { DriverAccountsManagement } from '@/components/staff/DriverAccountsManagement';
import { StaffProfilesManagement } from '@/components/corporate/StaffProfilesManagement';
import { PageHero } from '@/components/layout/PageHero';

const Staff = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedCity } = useCity();
  const { employee, isSuperAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('drivers');
  
  const cityMapping: Record<string, string[]> = {
    cairo: ['cairo', 'القاهرة', 'قاهرة', 'Cairo'],
    giza: ['giza', 'الجيزة', 'جيزة', 'Giza'],
    alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية', 'Alexandria'],
  };

  type Category = 'school' | 'corporate' | 'daily_lines';
  const ALL_CATEGORIES: Category[] = ['school', 'corporate', 'daily_lines'];

  // Derive legacy belongs_to from categories array (for back-compat with existing queries)
  const deriveBelongsTo = (cats: Category[]): 'school' | 'corporate' | 'both' => {
    const hasSchool = cats.includes('school');
    const hasCorp = cats.includes('corporate');
    if (hasSchool && hasCorp) return 'both';
    if (hasCorp) return 'corporate';
    return 'school';
  };

  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [driverForm, setDriverForm] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    city: 'Cairo',
    is_active: true,
    categories: ['school'] as Category[],
  });

  const [isSupervisorDialogOpen, setIsSupervisorDialogOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<any>(null);
  const [supervisorForm, setSupervisorForm] = useState({
    full_name: '',
    phone: '',
    city: 'Cairo',
    is_active: true,
    categories: ['school'] as Category[],
  });

  const { data: allDrivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('*').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: allSupervisors = [], isLoading: supervisorsLoading } = useQuery({
    queryKey: ['supervisors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supervisors').select('*').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Determine belongs_to filter based on employee departments
  const belongsToFilter = useMemo(() => {
    if (isSuperAdmin) return null; // no filter for super admins
    const depts = employee?.departments || [];
    const hasSchoolOps = depts.includes('operations');
    const hasCorpOps = depts.includes('operation_companies');
    if (hasSchoolOps && hasCorpOps) return null; // both — no filter
    if (hasSchoolOps) return 'school';
    if (hasCorpOps) return 'corporate';
    return null;
  }, [employee, isSuperAdmin]);

  const drivers = useMemo(() => {
    let filtered = allDrivers;
    // Filter by belongs_to based on employee department
    if (belongsToFilter) {
      filtered = filtered.filter((d: any) => d.belongs_to === belongsToFilter || d.belongs_to === 'both');
    }
    if (selectedCity === 'all') return filtered;
    const cityNames = cityMapping[selectedCity] || [];
    return filtered.filter((d: any) => cityNames.some((name) => d.city?.toLowerCase().includes(name.toLowerCase())));
  }, [allDrivers, selectedCity, belongsToFilter]);

  const supervisors = useMemo(() => {
    let filtered = allSupervisors;
    if (belongsToFilter) {
      filtered = filtered.filter((s: any) => s.belongs_to === belongsToFilter || s.belongs_to === 'both');
    }
    if (selectedCity === 'all') return filtered;
    const cityNames = cityMapping[selectedCity] || [];
    return filtered.filter((s: any) => cityNames.some((name) => s.city?.toLowerCase().includes(name.toLowerCase())));
  }, [allSupervisors, selectedCity, belongsToFilter]);

  const buildDriverPayload = () => ({
    full_name: driverForm.full_name,
    phone: driverForm.phone,
    license_number: driverForm.license_number,
    city: driverForm.city,
    is_active: driverForm.is_active,
    categories: driverForm.categories,
    belongs_to: deriveBelongsTo(driverForm.categories),
  });

  const buildSupervisorPayload = () => ({
    full_name: supervisorForm.full_name,
    phone: supervisorForm.phone,
    city: supervisorForm.city,
    is_active: supervisorForm.is_active,
    categories: supervisorForm.categories,
    belongs_to: deriveBelongsTo(supervisorForm.categories),
  });

  const saveDriverMutation = useMutation({
    mutationFn: async () => {
      const payload = buildDriverPayload();
      if (selectedDriver) {
        const { error } = await supabase.from('drivers').update(payload).eq('id', selectedDriver.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('drivers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['available-drivers'] });
      toast.success(selectedDriver ? t('staff.driverUpdated') : t('staff.driverAdded'));
      setIsDriverDialogOpen(false);
      resetDriverForm();
    },
    onError: (error) => { toast.error(t('staff.saveError')); console.error(error); },
  });

  const saveSupervisorMutation = useMutation({
    mutationFn: async () => {
      const payload = buildSupervisorPayload();
      if (selectedSupervisor) {
        const { error } = await supabase.from('supervisors').update(payload).eq('id', selectedSupervisor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('supervisors').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
      queryClient.invalidateQueries({ queryKey: ['available-supervisors'] });
      toast.success(selectedSupervisor ? t('staff.supervisorUpdated') : t('staff.supervisorAdded'));
      setIsSupervisorDialogOpen(false);
      resetSupervisorForm();
    },
    onError: (error) => { toast.error(t('staff.saveError')); console.error(error); },
  });

  const normalizeCategories = (record: any): Category[] => {
    if (Array.isArray(record?.categories) && record.categories.length > 0) {
      return record.categories.filter((c: string) => ALL_CATEGORIES.includes(c as Category)) as Category[];
    }
    if (record?.belongs_to === 'both') return ['school', 'corporate'];
    if (record?.belongs_to === 'corporate') return ['corporate'];
    if (record?.belongs_to === 'daily_lines') return ['daily_lines'];
    return ['school'];
  };

  const resetDriverForm = () => {
    setDriverForm({ full_name: '', phone: '', license_number: '', city: 'Cairo', is_active: true, categories: ['school'] });
    setSelectedDriver(null);
  };

  const resetSupervisorForm = () => {
    setSupervisorForm({ full_name: '', phone: '', city: 'Cairo', is_active: true, categories: ['school'] });
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
      categories: normalizeCategories(driver),
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
      categories: normalizeCategories(supervisor),
    });
    setIsSupervisorDialogOpen(true);
  };

  const toggleCategory = <T extends { categories: Category[] }>(
    form: T,
    setForm: React.Dispatch<React.SetStateAction<T>>,
    cat: Category,
  ) => {
    const has = form.categories.includes(cat);
    const next = has ? form.categories.filter((c) => c !== cat) : [...form.categories, cat];
    setForm({ ...form, categories: next });
  };

  const filteredDrivers = drivers.filter((d: any) =>
    d.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || d.phone.includes(searchTerm)
  );

  const filteredSupervisors = supervisors.filter((s: any) =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm)
  );

  const activeDriversCount = drivers.filter((d: any) => d.is_active).length;
  const activeSupervisorsCount = supervisors.filter((s: any) => s.is_active).length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHero
          icon={Users}
          title={t('staff.title')}
          description={t('staff.description')}
          stats={[
            { icon: Car, value: drivers.length, label: t('staff.totalDrivers') },
            { icon: UserCheck, value: activeDriversCount, label: t('staff.activeDrivers') },
            { icon: Users, value: supervisors.length, label: t('staff.totalSupervisors') },
            { icon: UserCheck, value: activeSupervisorsCount, label: t('staff.activeSupervisors') },
          ]}
          actions={
            <Button
              size="sm"
              className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm"
              onClick={() => {
                if (activeTab === 'drivers') { resetDriverForm(); setIsDriverDialogOpen(true); }
                else if (activeTab === 'supervisors') { resetSupervisorForm(); setIsSupervisorDialogOpen(true); }
              }}
            >
              <Plus className="h-4 w-4" />
              {activeTab === 'drivers' ? t('staff.addDriver') : t('staff.addSupervisor')}
            </Button>
          }
        />

        {/* Premium Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10"><Car className="h-4 w-4 text-primary" /></div>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{drivers.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('staff.totalDrivers')}</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-success/10"><UserCheck className="h-4 w-4 text-success" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{activeDriversCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('staff.activeDrivers')}</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-info/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-info/10"><Users className="h-4 w-4 text-info" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{supervisors.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('staff.totalSupervisors')}</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-warning/10"><UserCheck className="h-4 w-4 text-warning" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{activeSupervisorsCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('staff.activeSupervisors')}</p>
            </div>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted/50 p-1 rounded-xl h-auto">
              <TabsTrigger value="drivers" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                <Car className="h-4 w-4" />
                {t('staff.drivers')}
              </TabsTrigger>
              <TabsTrigger value="supervisors" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                <Users className="h-4 w-4" />
                {t('staff.supervisors')}
              </TabsTrigger>
              <TabsTrigger value="profiles" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                <CreditCard className="h-4 w-4" />
                ملفات الطاقم
              </TabsTrigger>
              <TabsTrigger value="accounts" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                <KeyRound className="h-4 w-4" />
                {t('staff.accounts')}
              </TabsTrigger>
            </TabsList>

            <div className="relative max-w-md mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('staff.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
              />
            </div>

            <TabsContent value="drivers">
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10"><Car className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t('staff.drivers')}</h2>
                    <p className="text-xs text-muted-foreground">{filteredDrivers.length} records</p>
                  </div>
                </div>
                {driversLoading ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 animate-pulse">
                      <Car className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  </div>
                ) : filteredDrivers.length === 0 ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
                      <Car className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">{t('staff.noDrivers')}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                         <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.name')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.phone')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('staff.licenseNumber')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.city')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('staff.belongsTo')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.status')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDrivers.map((driver: any) => (
                          <TableRow key={driver.id} className="group hover:bg-muted/20 transition-colors duration-150">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                  {driver.full_name[0].toUpperCase()}
                                </div>
                                <span className="font-medium text-sm text-foreground">{driver.full_name}</span>
                              </div>
                            </TableCell>
                            <TableCell dir="ltr" className="text-sm text-muted-foreground text-right">{driver.phone}</TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">{driver.license_number}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">{driver.city || t('common.notSpecified')}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {normalizeCategories(driver).map((c) => (
                                  <Badge key={c} variant="secondary" className="text-xs">
                                    {c === 'school' ? t('staff.school') : c === 'corporate' ? t('staff.corporate') : t('staff.dailyLines')}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {driver.is_active ? (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-success/10 text-success border-success/20">
                                  <UserCheck className="h-3 w-3" />
                                  {t('common.active')}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-muted/50 text-muted-foreground border-border/50">
                                  {t('common.inactive')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEditDriver(driver)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="supervisors">
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-info/10"><Users className="h-4 w-4 text-info" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t('staff.supervisors')}</h2>
                    <p className="text-xs text-muted-foreground">{filteredSupervisors.length} records</p>
                  </div>
                </div>
                {supervisorsLoading ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-info/10 mb-4 animate-pulse">
                      <Users className="h-6 w-6 text-info" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  </div>
                ) : filteredSupervisors.length === 0 ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">{t('staff.noSupervisors')}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                         <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.name')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.phone')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.city')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('staff.belongsTo')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.status')}</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSupervisors.map((supervisor: any) => (
                          <TableRow key={supervisor.id} className="group hover:bg-muted/20 transition-colors duration-150">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center text-xs font-bold text-info shrink-0">
                                  {supervisor.full_name[0].toUpperCase()}
                                </div>
                                <span className="font-medium text-sm text-foreground">{supervisor.full_name}</span>
                              </div>
                            </TableCell>
                            <TableCell dir="ltr" className="text-sm text-muted-foreground text-right">{supervisor.phone}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">{supervisor.city || t('common.notSpecified')}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {normalizeCategories(supervisor).map((c) => (
                                  <Badge key={c} variant="secondary" className="text-xs">
                                    {c === 'school' ? t('staff.school') : c === 'corporate' ? t('staff.corporate') : t('staff.dailyLines')}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {supervisor.is_active ? (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-success/10 text-success border-success/20">
                                  <UserCheck className="h-3 w-3" />
                                  {t('common.active')}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-muted/50 text-muted-foreground border-border/50">
                                  {t('common.inactive')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEditSupervisor(supervisor)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="profiles">
              <StaffProfilesManagement canEdit={true} staffContext="school" />
            </TabsContent>

            <TabsContent value="accounts">
              <DriverAccountsManagement staffContext="school" />
            </TabsContent>
          </Tabs>
        </div>

        {/* Driver Dialog */}
        <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedDriver ? t('staff.editDriver') : t('staff.addNewDriver')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (!driverForm.full_name || !driverForm.phone || !driverForm.license_number || !driverForm.city) { toast.error(t('staff.fillRequired')); return; } if (driverForm.categories.length === 0) { toast.error(t('staff.selectAtLeastOne')); return; } saveDriverMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driver_name">{t('common.name')} *</Label>
                <Input id="driver_name" value={driverForm.full_name} onChange={(e) => setDriverForm({ ...driverForm, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver_phone">{t('common.phone')} *</Label>
                <Input id="driver_phone" value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_number">{t('staff.licenseNumber')} *</Label>
                <Input id="license_number" value={driverForm.license_number} onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver_city">{t('common.city')} *</Label>
                <Select value={driverForm.city} onValueChange={(value) => setDriverForm({ ...driverForm, city: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="Cairo">Cairo</SelectItem>
                    <SelectItem value="Giza">Giza</SelectItem>
                    <SelectItem value="Alexandria">Alexandria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('staff.categories')} *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ALL_CATEGORIES.map((cat) => {
                    const checked = driverForm.categories.includes(cat);
                    const label = cat === 'school' ? t('staff.school') : cat === 'corporate' ? t('staff.corporate') : t('staff.dailyLines');
                    return (
                      <label
                        key={cat}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-primary/10 border-primary/40' : 'bg-card border-border hover:bg-muted/40'}`}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleCategory(driverForm, setDriverForm, cat)} />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="driver_active">{t('common.active')}</Label>
                <Switch id="driver_active" checked={driverForm.is_active} onCheckedChange={(checked) => setDriverForm({ ...driverForm, is_active: checked })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDriverDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={saveDriverMutation.isPending}>{saveDriverMutation.isPending ? t('common.loading') : t('common.save')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Supervisor Dialog */}
        <Dialog open={isSupervisorDialogOpen} onOpenChange={setIsSupervisorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedSupervisor ? t('staff.editSupervisor') : t('staff.addNewSupervisor')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (!supervisorForm.full_name || !supervisorForm.phone || !supervisorForm.city) { toast.error(t('staff.fillRequired')); return; } if (supervisorForm.categories.length === 0) { toast.error(t('staff.selectAtLeastOne')); return; } saveSupervisorMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supervisor_name">{t('common.name')} *</Label>
                <Input id="supervisor_name" value={supervisorForm.full_name} onChange={(e) => setSupervisorForm({ ...supervisorForm, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor_phone">{t('common.phone')} *</Label>
                <Input id="supervisor_phone" value={supervisorForm.phone} onChange={(e) => setSupervisorForm({ ...supervisorForm, phone: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor_city">{t('common.city')} *</Label>
                <Select value={supervisorForm.city} onValueChange={(value) => setSupervisorForm({ ...supervisorForm, city: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="Cairo">Cairo</SelectItem>
                    <SelectItem value="Giza">Giza</SelectItem>
                    <SelectItem value="Alexandria">Alexandria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('staff.categories')} *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ALL_CATEGORIES.map((cat) => {
                    const checked = supervisorForm.categories.includes(cat);
                    const label = cat === 'school' ? t('staff.school') : cat === 'corporate' ? t('staff.corporate') : t('staff.dailyLines');
                    return (
                      <label
                        key={cat}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-primary/10 border-primary/40' : 'bg-card border-border hover:bg-muted/40'}`}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleCategory(supervisorForm, setSupervisorForm, cat)} />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="supervisor_active">{t('common.active')}</Label>
                <Switch id="supervisor_active" checked={supervisorForm.is_active} onCheckedChange={(checked) => setSupervisorForm({ ...supervisorForm, is_active: checked })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsSupervisorDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={saveSupervisorMutation.isPending}>{saveSupervisorMutation.isPending ? t('common.loading') : t('common.save')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Staff;
