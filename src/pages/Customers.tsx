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
import { Plus, Search, Users, MapPin, Phone, Edit, Eye, TrendingUp, UserCheck, Building2, ShieldCheck, Loader2 } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import CustomerDialog from '@/components/customers/CustomerDialog';
import CustomerDetails from '@/components/customers/CustomerDetails';

type ParentAccount = Tables<'parent_accounts'>;

const Customers = () => {
  const { t } = useTranslation();
  const { selectedCity } = useCity();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ParentAccount | null>(null);

  const { data: allCustomers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ParentAccount[];
    },
  });

  const customers = useMemo(() => {
    if (selectedCity === 'all') return allCustomers;
    const cityMapping: Record<string, string[]> = {
      cairo: ['cairo', 'القاهرة', 'قاهرة'],
      giza: ['giza', 'الجيزة', 'جيزة'],
      alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
    };
    const cityNames = cityMapping[selectedCity] || [];
    return allCustomers.filter((c) =>
      cityNames.some((name) => c.city?.toLowerCase().includes(name.toLowerCase()))
    );
  }, [allCustomers, selectedCity]);

  const { data: registrationCounts = {} } = useQuery({
    queryKey: ['customer-registration-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('parent_id');
      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((reg) => {
        counts[reg.parent_id] = (counts[reg.parent_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Activation mutation
  const activateMutation = useMutation({
    mutationFn: async (parentId: string) => {
      const { data, error } = await supabase.functions.invoke('activate-parent-account', {
        body: { parent_id: parentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (data?.already_active) {
        toast.info('الحساب مفعل بالفعل');
      } else {
        toast.success('تم تفعيل الحساب بنجاح');
      }
    },
    onError: (error) => {
      toast.error('فشل في تفعيل الحساب: ' + error.message);
    },
  });

  const filteredCustomers = customers.filter((customer) =>
    customer.parent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.national_id.includes(searchTerm) ||
    customer.father_phone.includes(searchTerm) ||
    customer.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (customer: ParentAccount) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleViewDetails = (customer: ParentAccount) => {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
  };

  const handleAddNew = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const handleActivate = (e: React.MouseEvent, customer: ParentAccount) => {
    e.stopPropagation();
    activateMutation.mutate(customer.id);
  };

  const totalCustomers = customers.length;
  const uniqueCities = new Set(customers.map((c) => c.city)).size;
  const totalRegistrations = Object.values(registrationCounts).reduce((a, b) => a + b, 0);
  const withPassword = customers.filter((c) => c.has_password).length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Premium Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('customers.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('customers.description')}</p>
              </div>
            </div>
          </div>
          <Button onClick={handleAddNew} size="sm" className="gap-2 shadow-md hover:shadow-lg transition-all">
            <Plus className="h-4 w-4" />
            {t('customers.addCustomer')}
          </Button>
        </div>

        {/* Premium Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{totalCustomers}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('customers.totalCustomers')}</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-info/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-info/10"><Building2 className="h-4 w-4 text-info" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{uniqueCities}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('customers.cities')}</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-success/10"><Phone className="h-4 w-4 text-success" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{totalRegistrations}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('customers.totalRegistrations')}</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-warning/10"><UserCheck className="h-4 w-4 text-warning" /></div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">{withPassword}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Accounts</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('customers.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
            />
          </div>
        </div>

        {/* Premium Table */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">All Customers</h2>
                <p className="text-xs text-muted-foreground">{filteredCustomers.length} records found</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 animate-pulse">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">{t('customers.noCustomers')}</p>
              <p className="text-xs text-muted-foreground mb-4">Add your first customer to get started</p>
              <Button size="sm" onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('customers.addCustomer')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('customers.parentName')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('customers.nationalId')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('customers.fatherPhone')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.city')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('customers.registrations')}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="group hover:bg-muted/20 transition-colors duration-150 cursor-pointer"
                      onClick={() => handleViewDetails(customer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {customer.parent_name[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-sm text-foreground">{customer.parent_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">{customer.national_id}</TableCell>
                      <TableCell dir="ltr" className="text-sm text-muted-foreground text-right">{customer.father_phone}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{customer.city}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                          {registrationCounts[customer.id] || 0} students
                        </span>
                      </TableCell>
                      <TableCell>
                        {customer.user_id ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-success/10 text-success border-success/20">
                            <UserCheck className="h-3 w-3" />
                            مفعل
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-muted/50 text-muted-foreground border-border/50">
                            غير مفعل
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleViewDetails(customer)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleEdit(customer)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {!customer.user_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-success/10 hover:text-success"
                              onClick={(e) => handleActivate(e, customer)}
                              disabled={activateMutation.isPending}
                              title="تفعيل الحساب"
                            >
                              {activateMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ShieldCheck className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Dialogs */}
        <CustomerDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          customer={selectedCustomer}
        />
        <CustomerDetails
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          customer={selectedCustomer}
        />
      </div>
    </DashboardLayout>
  );
};

export default Customers;
