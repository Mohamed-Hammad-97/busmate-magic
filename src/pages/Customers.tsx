import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, Users, MapPin, Phone, Edit, Eye } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';
import type { Tables } from '@/integrations/supabase/types';
import CustomerDialog from '@/components/customers/CustomerDialog';
import CustomerDetails from '@/components/customers/CustomerDetails';

type ParentAccount = Tables<'parent_accounts'>;

const Customers = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedCity } = useCity();
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

  // Filter customers by city
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('customers.title')}</h1>
            <p className="text-muted-foreground">{t('customers.description')}</p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 ml-2" />
            {t('customers.addCustomer')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('customers.totalCustomers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('customers.cities')}</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(customers.map((c) => c.city)).size}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('customers.totalRegistrations')}</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(registrationCounts).reduce((a, b) => a + b, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('customers.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Customers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t('customers.parentName')}</TableHead>
                  <TableHead className="text-right">{t('customers.nationalId')}</TableHead>
                  <TableHead className="text-right">{t('customers.fatherPhone')}</TableHead>
                  <TableHead className="text-right">{t('common.city')}</TableHead>
                  <TableHead className="text-right">{t('customers.registrations')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t('common.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t('customers.noCustomers')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.parent_name}</TableCell>
                      <TableCell>{customer.national_id}</TableCell>
                      <TableCell dir="ltr" className="text-right">{customer.father_phone}</TableCell>
                      <TableCell>{customer.city}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {registrationCounts[customer.id] || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(customer)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Customer Dialog */}
        <CustomerDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          customer={selectedCustomer}
        />

        {/* Customer Details Dialog */}
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
