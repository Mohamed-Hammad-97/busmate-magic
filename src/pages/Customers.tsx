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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, Users, MapPin, Phone, Edit, Eye } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import CustomerDialog from '@/components/customers/CustomerDialog';
import CustomerDetails from '@/components/customers/CustomerDetails';

type ParentAccount = Tables<'parent_accounts'>;

const Customers = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ParentAccount | null>(null);

  const { data: customers = [], isLoading } = useQuery({
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
            <h1 className="text-3xl font-bold text-foreground">إدارة العملاء</h1>
            <p className="text-muted-foreground">إدارة حسابات أولياء الأمور ومعلومات الاتصال</p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة عميل
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي العملاء</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المدن</CardTitle>
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
              <CardTitle className="text-sm font-medium">إجمالي التسجيلات</CardTitle>
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
            placeholder="بحث بالاسم أو الرقم القومي أو الهاتف..."
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
                  <TableHead className="text-right">اسم ولي الأمر</TableHead>
                  <TableHead className="text-right">الرقم القومي</TableHead>
                  <TableHead className="text-right">هاتف الأب</TableHead>
                  <TableHead className="text-right">المدينة</TableHead>
                  <TableHead className="text-right">التسجيلات</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      لا يوجد عملاء
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
