import React, { useState, useMemo } from 'react';
import { Plus, Search, Eye, Edit2, ClipboardList, DollarSign, Link2, Map, TrendingUp, CheckCircle, Clock, XCircle, GraduationCap, Users, School, Trash2, UserX } from 'lucide-react';
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
import { PageHero } from '@/components/layout/PageHero';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'> & {
  parent_accounts: Tables<'parent_accounts'>;
  schools: Tables<'schools'>;
};

const Registrations: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedCity } = useCity();
  const isRtl = i18n.language === 'ar';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
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
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          *,
          parent_accounts (*),
          schools (*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Registration[];
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

  const filteredRegistrations = cityFilteredRegistrations.filter((reg) => {
    const matchesSearch =
      reg.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.parent_accounts?.parent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.parent_accounts?.national_id?.includes(searchQuery) ||
      reg.schools?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
    const matchesSchool = schoolFilter === 'all' || reg.school_id === schoolFilter;
    return matchesSearch && matchesStatus && matchesSchool;
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

  const totalCount = cityFilteredRegistrations.length;
  const completeCount = cityFilteredRegistrations.filter((r) => r.status === 'complete').length;
  const pendingCount = cityFilteredRegistrations.filter((r) => r.status === 'pending_fees').length;
  const cancelledCount = cityFilteredRegistrations.filter((r) => r.status === 'cancelled').length;
  const uniqueSchools = new Set(cityFilteredRegistrations.map((r) => r.school_id)).size;
  const completionRate = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  const getStatusConfig = (status: Enums<'registration_status'>) => {
    switch (status) {
      case 'complete':
        return { label: 'Complete', icon: CheckCircle, className: 'bg-success/10 text-success border-success/20' };
      case 'pending_fees':
        return { label: 'Pending Fees', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' };
      case 'cancelled':
        return { label: 'Cancelled', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' };
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
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student, parent, ID, or school..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
            />
          </div>
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
        </div>

        {/* Premium Table */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">All Registrations</h2>
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
              <p className="text-xs text-muted-foreground mb-4">Create your first registration to get started</p>
              <Button size="sm" onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Registration
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parent</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">School</TableHead>
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
