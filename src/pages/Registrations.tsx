import React, { useState, useMemo } from 'react';
import { Plus, Search, Eye, Edit2, ClipboardList, DollarSign, Link2, Map } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import RegistrationDialog from '@/components/registrations/RegistrationDialog';
import RegistrationDetails from '@/components/registrations/RegistrationDetails';
import SubscriptionDialog from '@/components/registrations/SubscriptionDialog';
import RegistrationsMap from '@/components/registrations/RegistrationsMap';
import { ShareButton } from '@/components/shared/ShareButton';
import { useCity } from '@/contexts/CityContext';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'> & {
  parent_accounts: Tables<'parent_accounts'>;
  schools: Tables<'schools'>;
};

const statusColors: Record<Enums<'registration_status'>, 'default' | 'secondary' | 'destructive'> = {
  pending_fees: 'secondary',
  complete: 'default',
  cancelled: 'destructive',
};

const statusLabels: Record<Enums<'registration_status'>, string> = {
  pending_fees: 'Pending Fees',
  complete: 'Complete',
  cancelled: 'Cancelled',
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

  // City mapping for consistent filtering
  const cityMapping: Record<string, string[]> = {
    cairo: ['cairo', 'القاهرة', 'قاهرة'],
    giza: ['giza', 'الجيزة', 'جيزة'],
    alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
  };

  // Filter by global city first
  const cityFilteredRegistrations = useMemo(() => {
    if (selectedCity === 'all') return registrations;
    const cityNames = cityMapping[selectedCity] || [];
    return registrations.filter((reg) => 
      cityNames.some((name) => reg.parent_accounts?.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [registrations, selectedCity]);

  const filteredRegistrations = cityFilteredRegistrations.filter((reg) => {
    const matchesSearch =
      reg.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.parent_accounts?.parent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.parent_accounts?.national_id?.includes(searchQuery) ||
      reg.schools?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
    return matchesSearch && matchesStatus;
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

  return (
    <DashboardLayout title="Registrations" description="Manage student registrations and enrollments">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student, parent, ID, or school..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_fees">Pending Fees</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMapOpen(true)}>
              <Map className="h-4 w-4 mr-2" />
              View Map
            </Button>
            <Button variant="outline" onClick={copyFormLink}>
              <Link2 className="h-4 w-4 mr-2" />
              {t('registrations.copyFormLink')}
            </Button>
            <ShareButton 
              url={formLink}
              title={isRtl ? 'رابط تسجيل الطلاب' : 'Student Registration Link'}
              text={isRtl ? 'سجل طفلك في خدمة النقل المدرسي' : 'Register your child for school bus service'}
            />
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              {t('registrations.newRegistration')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{registrations.length}</div>
              <p className="text-xs text-muted-foreground">Total Registrations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {registrations.filter((r) => r.status === 'complete').length}
              </div>
              <p className="text-xs text-muted-foreground">Complete</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">
                {registrations.filter((r) => r.status === 'pending_fees').length}
              </div>
              <p className="text-xs text-muted-foreground">Pending Fees</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">
                {registrations.filter((r) => r.status === 'cancelled').length}
              </div>
              <p className="text-xs text-muted-foreground">Cancelled</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Registrations ({filteredRegistrations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : filteredRegistrations.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No registrations found</p>
                <Button className="mt-4" onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Registration
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Parent Name</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Car Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">
                        {reg.student_name || '-'}
                      </TableCell>
                      <TableCell>{reg.parent_accounts?.parent_name || '-'}</TableCell>
                      <TableCell>{reg.schools?.name || '-'}</TableCell>
                      <TableCell>{reg.grade}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {reg.car_type === 'ac' ? 'AC' : 'Non-AC'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[reg.status]}>
                          {statusLabels[reg.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(reg.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(reg)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(reg)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {reg.status === 'pending_fees' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddFees(reg)}
                              className="text-green-600"
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
              <RegistrationsMap registrations={filteredRegistrations} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Registrations;
