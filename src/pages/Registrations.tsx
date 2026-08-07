import React, { useState, useMemo } from 'react';
import { Plus, Search, Eye, Edit2, ClipboardList, DollarSign, Link2, Map, TrendingUp, CheckCircle, Clock, XCircle, GraduationCap, Users, School, Trash2, UserX, Archive, Download, FileSpreadsheet, FileText, Phone, User, MapPin, HelpCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportRegistrationsExcel, exportRegistrationsPDF } from '@/lib/exportRegistrations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import RegistrationDialog from '@/components/registrations/RegistrationDialog';
import RegistrationDetails from '@/components/registrations/RegistrationDetails';
import SubscriptionDialog from '@/components/registrations/SubscriptionDialog';
import RegistrationsMap from '@/components/registrations/RegistrationsMap';
import { ShareButton } from '@/components/shared/ShareButton';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { useCity } from '@/contexts/CityContext';
import { useAuth } from '@/contexts/AuthContext';
import { PageHero } from '@/components/layout/PageHero';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'> & {
  parent_accounts: Tables<'parent_accounts'>;
  schools: Tables<'schools'>;
};

const Registrations: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedCity } = useCity();
  const { isSuperAdmin, hasDepartment } = useAuth();
  const canManage = isSuperAdmin || hasDepartment('customer_support');
  const isRtl = i18n.language === 'ar';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [mainTab, setMainTab] = useState<'active' | 'archive' | 'other'>('active');
  const [archiveYear, setArchiveYear] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null);
  const [deleteMode, setDeleteMode] = useState<'deactivate' | 'delete'>('deactivate');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formLink = `${window.location.origin}/register`;

  const copyFormLink = () => {
    navigator.clipboard.writeText(formLink);
    toast({ title: t('common.copied'), description: formLink });
  };

  const handleAddFees = (registration: Registration) => {
    setSelectedRegistration(registration);
    setSubscriptionOpen(true);
  };

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ['registrations'],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: Registration[] = [];
      // Paginate past Supabase's 1000-row cap so filters can see every record.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('registrations')
          .select(`
            *,
            parent_accounts (*),
            schools (*)
          `)
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as Registration[];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const cityMapping: Record<string, string[]> = {
    cairo: ['cairo', 'القاهرة', 'قاهرة'],
    giza: ['giza', 'الجيزة', 'جيزة'],
    alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
  };

  const cityFilteredRegistrations = useMemo(() => {
    if (selectedCity === 'all') return registrations;
    const cityNames = cityMapping[selectedCity] || [];
    return registrations.filter((reg) =>
      cityNames.some((name) => reg.parent_accounts?.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [registrations, selectedCity]);

  // Get unique schools for filter dropdown
  const schoolsList = useMemo(() => {
    const schoolsMap: Record<string, string> = {};
    cityFilteredRegistrations.forEach((reg) => {
      if (reg.schools?.id && reg.schools?.name) {
        schoolsMap[reg.schools.id] = reg.schools.name;
      }
    });
    return Object.entries(schoolsMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cityFilteredRegistrations]);

  // Archive bucket: all archived registrations, grouped by year (from updated_at)
  const archivedRegistrations = useMemo(
    () => cityFilteredRegistrations.filter((r) => r.status === 'archived'),
    [cityFilteredRegistrations]
  );

  const archiveYears = useMemo(() => {
    const counts: Record<string, number> = {};
    archivedRegistrations.forEach((r) => {
      const y = String(new Date(r.updated_at || r.created_at).getFullYear());
      counts[y] = (counts[y] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => Number(b.year) - Number(a.year));
  }, [archivedRegistrations]);

  const filteredRegistrations = cityFilteredRegistrations.filter((reg) => {
    const matchesSearch =
      reg.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.parent_accounts?.parent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.parent_accounts?.national_id?.includes(searchQuery) ||
      reg.schools?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSchool = schoolFilter === 'all' || reg.school_id === schoolFilter;

    const phoneNorm = phoneFilter.replace(/\s+/g, '');
    const matchesPhone = !phoneNorm || [
      reg.parent_accounts?.father_phone,
      reg.parent_accounts?.mother_phone,
      reg.parent_accounts?.emergency_phone,
      reg.parent_accounts?.payment_phone,
    ].some((p) => (p || '').replace(/\s+/g, '').includes(phoneNorm));

    const nameNorm = nameFilter.trim().toLowerCase();
    const matchesName = !nameNorm || [
      reg.student_name,
      reg.parent_accounts?.parent_name,
    ].some((n) => (n || '').toLowerCase().includes(nameNorm));

    if (mainTab === 'archive') {
      if (reg.status !== 'archived') return false;
      const y = String(new Date(reg.updated_at || reg.created_at).getFullYear());
      const matchesYear = archiveYear === 'all' || y === archiveYear;
      return matchesSearch && matchesSchool && matchesYear && matchesPhone && matchesName;
    }

    const matchesStatus =
      statusFilter === 'all' ? reg.status !== 'archived' : reg.status === statusFilter;
    return matchesSearch && matchesStatus && matchesSchool && matchesPhone && matchesName;
  });

  const handleViewDetails = (registration: Registration) => {
    setSelectedRegistration(registration);
    setDetailsOpen(true);
  };

  const handleEdit = (registration: Registration) => {
    setSelectedRegistration(registration);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedRegistration(null);
    setDialogOpen(true);
  };

  const deactivateMutation = useMutation({
    mutationFn: async (reg: Registration) => {
      // Cancel the registration
      const { error: regError } = await supabase
        .from('registrations')
        .update({ status: 'cancelled' })
        .eq('id', reg.id);
      if (regError) throw regError;
      // Deactivate the parent account
      const { error: parentError } = await supabase
        .from('parent_accounts')
        .update({ is_active: false })
        .eq('id', reg.parent_id);
      if (parentError) throw parentError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Account deactivated', description: 'The registration has been cancelled and the parent account deactivated.' });
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to deactivate account', variant: 'destructive' });
      console.error(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reg: Registration) => {
      // Delete payments -> subscriptions -> route_assignments -> registration
      const { data: subs } = await supabase.from('subscriptions').select('id').eq('registration_id', reg.id);
      if (subs && subs.length > 0) {
        const subIds = subs.map(s => s.id);
        await supabase.from('payments').delete().in('subscription_id', subIds);
        await supabase.from('subscriptions').delete().eq('registration_id', reg.id);
      }
      await supabase.from('route_assignments').delete().eq('registration_id', reg.id);
      await supabase.from('student_absences').delete().eq('registration_id', reg.id);
      const { error } = await supabase.from('registrations').delete().eq('id', reg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Registration deleted', description: 'The registration and all related data have been permanently removed.' });
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to delete registration', variant: 'destructive' });
      console.error(error);
    },
  });

  const confirmAction = () => {
    if (!deleteTarget) return;
    if (deleteMode === 'deactivate') deactivateMutation.mutate(deleteTarget);
    else deleteMutation.mutate(deleteTarget);
  };

  const activeRegs = cityFilteredRegistrations.filter((r) => r.status !== 'archived');
  const archivedRegs = cityFilteredRegistrations.filter((r) => r.status === 'archived');
  const totalCount = activeRegs.length;
  const completeCount = activeRegs.filter((r) => r.status === 'complete').length;
  const pendingCount = activeRegs.filter((r) => r.status === 'pending_fees').length;
  const cancelledCount = activeRegs.filter((r) => r.status === 'cancelled').length;
  const uniqueSchools = new Set(activeRegs.map((r) => r.school_id)).size;
  const completionRate = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  // Archive breakdown (for small sub-labels under each active stat)
  const archiveTotal = archivedRegs.length;
  const archiveComplete = archivedRegs.filter((r) => r.status === 'complete').length;
  const archivePending = archivedRegs.filter((r) => r.status === 'pending_fees').length;
  const archiveCancelled = archivedRegs.filter((r) => r.status === 'cancelled').length;
  const archiveSchools = new Set(archivedRegs.map((r) => r.school_id)).size;
  const grandTotal = totalCount + archiveTotal;
  const grandComplete = completeCount + archiveComplete;
  const grandPending = pendingCount + archivePending;
  const grandCancelled = cancelledCount + archiveCancelled;
  const grandSchools = new Set(cityFilteredRegistrations.map((r) => r.school_id)).size;

  const getStatusConfig = (status: Enums<'registration_status'>) => {
    switch (status) {
      case 'complete':
        return { label: 'Complete', icon: CheckCircle, className: 'bg-success/10 text-success border-success/20' };
      case 'pending_fees':
        return { label: 'Pending Fees', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' };
      case 'cancelled':
        return { label: 'Cancelled', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'archived':
        return { label: 'Archived', icon: Archive, className: 'bg-muted text-muted-foreground border-muted' };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHero
          icon={ClipboardList}
          title="Registrations"
          description="Manage student registrations and enrollments"
          stats={[
            { icon: GraduationCap, value: totalCount, label: 'Total' },
            { icon: CheckCircle, value: completeCount, label: 'Complete' },
            { icon: Clock, value: pendingCount, label: 'Pending' },
            { icon: School, value: uniqueSchools, label: 'Schools' },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" size="sm" onClick={() => setMapOpen(true)} className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm">
                <Map className="h-4 w-4" />
                Map View
              </Button>
              {canManage && (
                <>
                  <Button variant="secondary" size="sm" onClick={copyFormLink} className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm">
                    <Link2 className="h-4 w-4" />
                    {t('registrations.copyFormLink')}
                  </Button>
                  <ShareButton
                    url={formLink}
                    title={isRtl ? 'رابط تسجيل الطلاب' : 'Student Registration Link'}
                    text={isRtl ? 'سجل طفلك في خدمة النقل المدرسي' : 'Register your child for school bus service'}
                  />
                  <Button size="sm" className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm" onClick={handleAddNew}>
                    <Plus className="h-4 w-4" />
                    {t('registrations.newRegistration')}
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* Premium Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Total */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{totalCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Registrations</p>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Archive: <span className="font-semibold text-foreground/70">{archiveTotal}</span></span>
                <span>Total: <span className="font-semibold text-foreground/70">{grandTotal}</span></span>
              </div>
            </div>
          </div>

          {/* Complete */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="h-4 w-4 text-success" />
                </div>
                <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">{completionRate}%</span>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{completeCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Complete</p>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Archive: <span className="font-semibold text-foreground/70">{archiveComplete}</span></span>
                <span>Total: <span className="font-semibold text-foreground/70">{grandComplete}</span></span>
              </div>
            </div>
          </div>

          {/* Pending */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Pending Fees</p>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Archive: <span className="font-semibold text-foreground/70">{archivePending}</span></span>
                <span>Total: <span className="font-semibold text-foreground/70">{grandPending}</span></span>
              </div>
            </div>
          </div>

          {/* Cancelled */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-destructive/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{cancelledCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Cancelled</p>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Archive: <span className="font-semibold text-foreground/70">{archiveCancelled}</span></span>
                <span>Total: <span className="font-semibold text-foreground/70">{grandCancelled}</span></span>
              </div>
            </div>
          </div>

          {/* Schools */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 col-span-2 lg:col-span-1">
            <div className="absolute top-0 right-0 w-20 h-20 bg-info/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <School className="h-4 w-4 text-info" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{uniqueSchools}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Schools</p>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Archive: <span className="font-semibold text-foreground/70">{archiveSchools}</span></span>
                <span>Total: <span className="font-semibold text-foreground/70">{grandSchools}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Active / Archive / Other Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'active' | 'archive' | 'other')}>
            <TabsList>
              <TabsTrigger value="active" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Active
                <Badge variant="secondary" className="ml-1">{cityFilteredRegistrations.filter((r) => r.status !== 'archived').length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="archive" className="gap-2">
                <Archive className="h-4 w-4" />
                Archive
                <Badge variant="secondary" className="ml-1">{archivedRegistrations.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="other" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                Other Registrations
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {canManage && mainTab !== 'other' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 h-10 rounded-xl shadow-sm">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => exportRegistrationsExcel(filteredRegistrations, `registrations-${mainTab}`)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                  Download Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRegistrationsPDF(filteredRegistrations, `registrations-${mainTab}`, `Registrations — ${mainTab === 'active' ? 'Active' : 'Archive'}`)}>
                  <FileText className="h-4 w-4 mr-2 text-red-600" />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Archive year pills */}
        {mainTab === 'archive' && archiveYears.length > 0 && (
          <div className="flex flex-wrap gap-2 animate-fade-in">
            <button
              type="button"
              onClick={() => setArchiveYear('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${archiveYear === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border/50 hover:bg-muted/50'}`}
            >
              All Years <span className="ml-1 opacity-70">({archivedRegistrations.length})</span>
            </button>
            {archiveYears.map((y) => (
              <button
                key={y.year}
                type="button"
                onClick={() => setArchiveYear(y.year)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${archiveYear === y.year ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border/50 hover:bg-muted/50'}`}
              >
                {y.year} <span className="ml-1 opacity-70">({y.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in flex-wrap" style={{ animationDelay: '0.2s' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student, parent, ID, or school..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
            />
          </div>
          <div className="relative w-full sm:w-[200px]">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by phone..."
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
              dir="ltr"
            />
          </div>
          <div className="relative w-full sm:w-[200px]">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
            />
          </div>
          {mainTab === 'active' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-11 bg-card border-border/50 rounded-xl">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border z-50 rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_fees">Pending Fees</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-11 bg-card border-border/50 rounded-xl">
              <SelectValue placeholder="All Schools" />
            </SelectTrigger>
            <SelectContent className="bg-card border border-border z-50 rounded-xl">
              <SelectItem value="all">All Schools</SelectItem>
              {schoolsList.map((school) => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Premium Table */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                {mainTab === 'archive' ? <Archive className="h-4 w-4 text-primary" /> : <ClipboardList className="h-4 w-4 text-primary" />}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {mainTab === 'archive'
                    ? archiveYear === 'all' ? 'Archived Registrations' : `Archived Registrations · ${archiveYear}`
                    : 'All Registrations'}
                </h2>
                <p className="text-xs text-muted-foreground">{filteredRegistrations.length} records found</p>
              </div>
            </div>
          </div>


          {isLoading ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 animate-pulse">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Loading registrations...</p>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
                <ClipboardList className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No registrations found</p>
              <p className="text-xs text-muted-foreground mb-4">{canManage ? 'Create your first registration to get started' : 'No records to display'}</p>
              {canManage && (
                <Button size="sm" onClick={handleAddNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Registration
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parent</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">School</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pickup Address</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grade</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((reg, index) => {
                    const statusConfig = getStatusConfig(reg.status);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <TableRow
                        key={reg.id}
                        className="group hover:bg-muted/20 transition-colors duration-150 cursor-pointer"
                        onClick={() => handleViewDetails(reg)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {(reg.student_name || '?')[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-sm text-foreground">{reg.student_name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{reg.parent_accounts?.parent_name || '-'}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{reg.schools?.name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {reg.parent_accounts?.pickup_address ? (
                            <span className="text-xs text-muted-foreground line-clamp-2 max-w-[220px] inline-flex items-start gap-1" title={reg.parent_accounts.pickup_address}>
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                              {reg.parent_accounts.pickup_address}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium bg-muted/50 text-foreground px-2 py-1 rounded-md">{reg.grade}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-1 rounded-md ${reg.car_type === 'ac' ? 'bg-info/10 text-info' : 'bg-muted/50 text-muted-foreground'}`}>
                            {reg.car_type === 'ac' ? 'AC' : 'Non-AC'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${statusConfig.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleViewDetails(reg)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canManage && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleEdit(reg)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                {reg.status === 'pending_fees' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-success/10 hover:text-success" onClick={() => handleAddFees(reg)}>
                                    <DollarSign className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {reg.status !== 'cancelled' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-warning/10 hover:text-warning" onClick={() => { setDeleteTarget(reg); setDeleteMode('deactivate'); }} title="Deactivate">
                                    <UserX className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleteTarget(reg); setDeleteMode('delete'); }} title="Delete permanently">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Dialogs */}
        <RegistrationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          registration={selectedRegistration}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['registrations'] });
            setDialogOpen(false);
          }}
        />

        <RegistrationDetails
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          registration={selectedRegistration}
        />

        <SubscriptionDialog
          open={subscriptionOpen}
          onOpenChange={setSubscriptionOpen}
          registration={selectedRegistration}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['registrations'] });
            setSubscriptionOpen(false);
          }}
        />

        {/* Map Dialog */}
        <Dialog open={mapOpen} onOpenChange={setMapOpen}>
          <DialogContent className="max-w-6xl h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Student Locations Map
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <GoogleMapsProvider>
                <RegistrationsMap registrations={filteredRegistrations} />
              </GoogleMapsProvider>
            </div>
          </DialogContent>
        </Dialog>

        {/* Deactivate/Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteMode === 'deactivate' ? 'Deactivate Account?' : 'Delete Registration Permanently?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteMode === 'deactivate'
                  ? `This will cancel the registration for "${deleteTarget?.student_name}" and deactivate the parent account. The parent will no longer be able to log in.`
                  : `This will permanently delete the registration for "${deleteTarget?.student_name}" and all related payments, subscriptions, and route assignments. This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={deleteMode === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-warning text-warning-foreground hover:bg-warning/90'}
                onClick={confirmAction}
                disabled={deactivateMutation.isPending || deleteMutation.isPending}
              >
                {deleteMode === 'deactivate' ? 'Deactivate' : 'Delete Permanently'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Registrations;
