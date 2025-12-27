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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, CreditCard, CheckCircle, Clock, AlertCircle, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const Payments = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          subscriptions (
            registration_id,
            subscription_type,
            value,
            registrations (
              parent_accounts (parent_name)
            )
          )
        `)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('تم تسجيل الدفع بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تسجيل الدفع');
      console.error(error);
    },
  });

  const filteredPayments = payments.filter((payment: any) => {
    const parentName = payment.subscriptions?.registrations?.parent_accounts?.parent_name || '';
    const matchesSearch = parentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    paid: { label: 'مدفوع', variant: 'default', icon: <CheckCircle className="h-4 w-4" /> },
    pending: { label: 'في الانتظار', variant: 'secondary', icon: <Clock className="h-4 w-4" /> },
    overdue: { label: 'متأخر', variant: 'destructive', icon: <AlertCircle className="h-4 w-4" /> },
  };

  const subscriptionTypeLabels: Record<string, string> = {
    monthly: 'شهري',
    yearly: 'سنوي',
  };

  const stats = {
    total: payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    paid: payments.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    pending: payments.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    overdue: payments.filter((p: any) => p.status === 'overdue').reduce((sum: number, p: any) => sum + Number(p.amount), 0),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة المدفوعات</h1>
          <p className="text-muted-foreground">متابعة الأقساط والمدفوعات</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المستحق</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()} ج.م</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المدفوع</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.paid.toLocaleString()} ج.م</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">في الانتظار</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending.toLocaleString()} ج.م</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">متأخر</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.overdue.toLocaleString()} ج.م</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم ولي الأمر..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="حالة الدفع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="paid">مدفوع</SelectItem>
              <SelectItem value="pending">في الانتظار</SelectItem>
              <SelectItem value="overdue">متأخر</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payments Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">ولي الأمر</TableHead>
                  <TableHead className="text-right">نوع الاشتراك</TableHead>
                  <TableHead className="text-right">رقم القسط</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                  <TableHead className="text-right">تاريخ الدفع</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      لا توجد مدفوعات
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.subscriptions?.registrations?.parent_accounts?.parent_name || '-'}
                      </TableCell>
                      <TableCell>
                        {subscriptionTypeLabels[payment.subscriptions?.subscription_type] || '-'}
                      </TableCell>
                      <TableCell>{payment.installment_number}</TableCell>
                      <TableCell>{Number(payment.amount).toLocaleString()} ج.م</TableCell>
                      <TableCell>
                        {format(new Date(payment.due_date), 'dd MMM yyyy', { locale: ar })}
                      </TableCell>
                      <TableCell>
                        {payment.paid_date
                          ? format(new Date(payment.paid_date), 'dd MMM yyyy', { locale: ar })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusLabels[payment.status]?.variant || 'secondary'}
                          className="gap-1"
                        >
                          {statusLabels[payment.status]?.icon}
                          {statusLabels[payment.status]?.label || payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.status !== 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markPaidMutation.mutate(payment.id)}
                            disabled={markPaidMutation.isPending}
                          >
                            <Check className="h-4 w-4 ml-1" />
                            تسجيل دفع
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Payments;
