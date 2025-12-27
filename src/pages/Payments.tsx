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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, CreditCard, CheckCircle, Clock, AlertCircle, Check, Eye, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PaymentProfileDialog } from '@/components/payments/PaymentProfileDialog';

const Payments = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [installmentFilter, setInstallmentFilter] = useState<string>('');
  const [paymentTab, setPaymentTab] = useState<string>('all');
  const [selectedRegistration, setSelectedRegistration] = useState<{
    registrationId: string;
    payments: any[];
    subscription: any;
    parentName: string;
    studentName: string;
  } | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          subscriptions (
            id,
            registration_id,
            subscription_type,
            value,
            number_of_installments,
            registrations (
              id,
              student_name,
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

  // Group payments by registration for profile view and payment status calculation
  const paymentsByRegistration = useMemo(() => {
    const grouped: Record<string, {
      registrationId: string;
      payments: any[];
      subscription: any;
      parentName: string;
      studentName: string;
      totalAmount: number;
      paidAmount: number;
      isFullyPaid: boolean;
    }> = {};

    payments.forEach((payment: any) => {
      const registrationId = payment.subscriptions?.registration_id;
      if (!registrationId) return;

      if (!grouped[registrationId]) {
        grouped[registrationId] = {
          registrationId,
          payments: [],
          subscription: payment.subscriptions,
          parentName: payment.subscriptions?.registrations?.parent_accounts?.parent_name || '',
          studentName: payment.subscriptions?.registrations?.student_name || '',
          totalAmount: payment.subscriptions?.value || 0,
          paidAmount: 0,
          isFullyPaid: false,
        };
      }

      grouped[registrationId].payments.push(payment);
      if (payment.status === 'paid') {
        grouped[registrationId].paidAmount += Number(payment.amount);
      }
    });

    // Calculate if fully paid
    Object.values(grouped).forEach((reg) => {
      reg.isFullyPaid = reg.paidAmount >= reg.totalAmount;
    });

    return grouped;
  }, [payments]);

  // Filter by payment status tab (fully paid vs partial)
  const filteredByPaymentStatus = useMemo(() => {
    if (paymentTab === 'all') return payments;
    
    const registrationIds = Object.values(paymentsByRegistration)
      .filter(reg => paymentTab === 'fully_paid' ? reg.isFullyPaid : !reg.isFullyPaid)
      .map(reg => reg.registrationId);

    return payments.filter((payment: any) => 
      registrationIds.includes(payment.subscriptions?.registration_id)
    );
  }, [payments, paymentsByRegistration, paymentTab]);

  const filteredPayments = filteredByPaymentStatus.filter((payment: any) => {
    const parentName = payment.subscriptions?.registrations?.parent_accounts?.parent_name || '';
    const studentName = payment.subscriptions?.registrations?.student_name || '';
    const matchesSearch = 
      parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      studentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    
    // Filter by number of installments
    const matchesInstallments = !installmentFilter || 
      payment.subscriptions?.number_of_installments === parseInt(installmentFilter);
    
    return matchesSearch && matchesStatus && matchesInstallments;
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

  // Tab stats
  const tabStats = useMemo(() => {
    const registrations = Object.values(paymentsByRegistration);
    const fullyPaid = registrations.filter(r => r.isFullyPaid);
    const partial = registrations.filter(r => !r.isFullyPaid);
    
    return {
      fullyPaidCount: fullyPaid.length,
      fullyPaidAmount: fullyPaid.reduce((sum, r) => sum + r.paidAmount, 0),
      partialCount: partial.length,
      partialPaidAmount: partial.reduce((sum, r) => sum + r.paidAmount, 0),
      partialRemainingAmount: partial.reduce((sum, r) => sum + (r.totalAmount - r.paidAmount), 0),
    };
  }, [paymentsByRegistration]);

  const openPaymentProfile = (payment: any) => {
    const registrationId = payment.subscriptions?.registration_id;
    const regData = paymentsByRegistration[registrationId];
    if (regData) {
      setSelectedRegistration(regData);
    }
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

        {/* Payment Status Tabs */}
        <Tabs value={paymentTab} onValueChange={setPaymentTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="fully_paid" className="flex items-center gap-2">
              مدفوع بالكامل
              <Badge variant="outline" className="text-xs">
                {tabStats.fullyPaidCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="partial" className="flex items-center gap-2">
              دفع جزئي
              <Badge variant="outline" className="text-xs">
                {tabStats.partialCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Tab Summary Cards */}
          {paymentTab === 'fully_paid' && (
            <Card className="mt-4 bg-green-50 dark:bg-green-900/20 border-green-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-green-700 dark:text-green-300">إجمالي المدفوع بالكامل:</span>
                  <span className="font-bold text-green-700 dark:text-green-300">
                    {tabStats.fullyPaidAmount.toLocaleString()} ج.م ({tabStats.fullyPaidCount} تسجيل)
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {paymentTab === 'partial' && (
            <Card className="mt-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-orange-700 dark:text-orange-300">المدفوع حتى الآن:</span>
                  <span className="font-bold text-orange-700 dark:text-orange-300">
                    {tabStats.partialPaidAmount.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-orange-700 dark:text-orange-300">المتبقي:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {tabStats.partialRemainingAmount.toLocaleString()} ج.م
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <TabsContent value={paymentTab} className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative max-w-sm">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث باسم ولي الأمر أو الطالب..."
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
              <div className="relative w-[180px]">
                <Hash className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="عدد الأقساط..."
                  value={installmentFilter}
                  onChange={(e) => setInstallmentFilter(e.target.value)}
                  className="pr-10"
                  min="1"
                  max="10"
                />
              </div>
            </div>

            {/* Payments Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">ولي الأمر</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-right">نوع الاشتراك</TableHead>
                      <TableHead className="text-right">عدد الأقساط</TableHead>
                      <TableHead className="text-right">رقم القسط</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
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
                            {payment.subscriptions?.registrations?.student_name || '-'}
                          </TableCell>
                          <TableCell>
                            {subscriptionTypeLabels[payment.subscriptions?.subscription_type] || '-'}
                          </TableCell>
                          <TableCell>
                            {payment.subscriptions?.number_of_installments || '-'}
                          </TableCell>
                          <TableCell>{payment.installment_number}</TableCell>
                          <TableCell>{Number(payment.amount).toLocaleString()} ج.م</TableCell>
                          <TableCell>
                            {format(new Date(payment.due_date), 'dd MMM yyyy', { locale: ar })}
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
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPaymentProfile(payment)}
                                title="عرض الملف"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {payment.status !== 'paid' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markPaidMutation.mutate(payment.id)}
                                  disabled={markPaidMutation.isPending}
                                  title="تسجيل دفع"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
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
      </div>

      {/* Payment Profile Dialog */}
      {selectedRegistration && (
        <PaymentProfileDialog
          open={!!selectedRegistration}
          onOpenChange={(open) => !open && setSelectedRegistration(null)}
          registrationId={selectedRegistration.registrationId}
          payments={selectedRegistration.payments}
          subscription={selectedRegistration.subscription}
          parentName={selectedRegistration.parentName}
          studentName={selectedRegistration.studentName}
        />
      )}
    </DashboardLayout>
  );
};

export default Payments;
