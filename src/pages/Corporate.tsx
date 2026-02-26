import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Building2, Plus, Search, Edit, MapPin, User, Truck,
  TrendingUp, Eye, CalendarDays, CreditCard, FileText, DollarSign,
} from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { CompanyLinesManagement } from '@/components/corporate/CompanyLinesManagement';
import { CorporateAttendance } from '@/components/corporate/CorporateAttendance';
import { StaffProfilesManagement } from '@/components/corporate/StaffProfilesManagement';
import { SalaryManagement } from '@/components/corporate/SalaryManagement';
import { CompanyInvoices } from '@/components/corporate/CompanyInvoices';

const Corporate = () => {
  const queryClient = useQueryClient();
  const { hasDepartment, isSuperAdmin } = useAuth();
  const canEdit = hasDepartment('operation_companies') || isSuperAdmin;
  const isFinance = hasDepartment('finance') || isSuperAdmin;

  const [activeTab, setActiveTab] = useState('companies');
  const [searchTerm, setSearchTerm] = useState('');
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedCompanyForLines, setSelectedCompanyForLines] = useState<any>(null);
  const [companyForm, setCompanyForm] = useState({
    name: '', city: '', location_address: '', contact_person_name: '',
    contact_person_phone: '', notes: '', is_active: true,
  });

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: companyLines = [] } = useQuery({
    queryKey: ['company-lines-count'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_lines').select('id, company_id');
      if (error) throw error;
      return data;
    },
  });

  const saveCompanyMutation = useMutation({
    mutationFn: async () => {
      if (selectedCompany) {
        const { error } = await supabase.from('companies').update(companyForm).eq('id', selectedCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('companies').insert(companyForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(selectedCompany ? 'تم تحديث الشركة' : 'تم إضافة الشركة');
      setCompanyDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const resetForm = () => {
    setCompanyForm({ name: '', city: '', location_address: '', contact_person_name: '', contact_person_phone: '', notes: '', is_active: true });
    setSelectedCompany(null);
  };

  const handleEdit = (company: any) => {
    setSelectedCompany(company);
    setCompanyForm({
      name: company.name, city: company.city, location_address: company.location_address || '',
      contact_person_name: company.contact_person_name, contact_person_phone: company.contact_person_phone,
      notes: company.notes || '', is_active: company.is_active,
    });
    setCompanyDialogOpen(true);
  };

  const filteredCompanies = companies.filter((c: any) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact_person_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact_person_phone.includes(searchTerm)
  );

  const activeCompanies = companies.filter((c: any) => c.is_active).length;
  const totalLines = companyLines.length;

  if (selectedCompanyForLines) {
    return (
      <DashboardLayout>
        <CompanyLinesManagement
          company={selectedCompanyForLines}
          onBack={() => setSelectedCompanyForLines(null)}
          canEdit={canEdit}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHero
          icon={Building2}
          title="إدارة الشركات"
          description="تسجيل الشركات وإدارة الخطوط والحضور والرواتب"
          stats={[
            { icon: Building2, value: companies.length, label: 'إجمالي الشركات' },
            { icon: TrendingUp, value: activeCompanies, label: 'شركات نشطة' },
            { icon: Truck, value: totalLines, label: 'إجمالي الخطوط' },
          ]}
          actions={canEdit && activeTab === 'companies' ? (
            <Button
              size="sm"
              className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm"
              onClick={() => { resetForm(); setCompanyDialogOpen(true); }}
            >
              <Plus className="h-4 w-4" />
              إضافة شركة
            </Button>
          ) : undefined}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
            <TabsTrigger value="companies" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Building2 className="h-4 w-4" />
              الشركات
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <CalendarDays className="h-4 w-4" />
              الحضور
            </TabsTrigger>
            <TabsTrigger value="profiles" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <CreditCard className="h-4 w-4" />
              ملفات الموظفين
            </TabsTrigger>
            {isFinance && (
              <TabsTrigger value="salaries" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                <DollarSign className="h-4 w-4" />
                الرواتب
              </TabsTrigger>
            )}
            {isFinance && (
              <TabsTrigger value="invoices" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                <FileText className="h-4 w-4" />
                الفواتير
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="companies">
            <div className="space-y-6">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو رقم الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
                />
              </div>

              {/* Companies Table */}
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10"><Building2 className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">الشركات</h2>
                    <p className="text-xs text-muted-foreground">{filteredCompanies.length} شركة</p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 animate-pulse">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                  </div>
                ) : filteredCompanies.length === 0 ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">لا توجد شركات</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">اسم الشركة</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">المدينة</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">جهة الاتصال</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">رقم الهاتف</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">الخطوط</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">الحالة</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCompanies.map((company: any) => {
                          const lineCount = companyLines.filter((l: any) => l.company_id === company.id).length;
                          return (
                            <TableRow key={company.id} className="group hover:bg-muted/20 transition-colors duration-150">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                    {company.name[0].toUpperCase()}
                                  </div>
                                  <span className="font-medium text-sm text-foreground">{company.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">{company.city}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">{company.contact_person_name}</span>
                                </div>
                              </TableCell>
                              <TableCell dir="ltr" className="text-sm text-muted-foreground text-right">{company.contact_person_phone}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono">{lineCount}</Badge>
                              </TableCell>
                              <TableCell>
                                {company.is_active ? (
                                  <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-success/10 text-success border-success/20">نشط</div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-muted/50 text-muted-foreground border-border/50">غير نشط</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedCompanyForLines(company)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {canEdit && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleEdit(company)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
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
            </div>
          </TabsContent>

          <TabsContent value="attendance">
            <CorporateAttendance canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="profiles">
            <StaffProfilesManagement canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="salaries">
            <SalaryManagement />
          </TabsContent>

          <TabsContent value="invoices">
            <CompanyInvoices />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Company Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={(open) => { setCompanyDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCompany ? 'تعديل الشركة' : 'إضافة شركة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم الشركة *</Label>
                <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="اسم الشركة" />
              </div>
              <div className="space-y-2">
                <Label>المدينة *</Label>
                <Input value={companyForm.city} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} placeholder="المدينة" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input value={companyForm.location_address} onChange={(e) => setCompanyForm({ ...companyForm, location_address: e.target.value })} placeholder="العنوان التفصيلي" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم جهة الاتصال *</Label>
                <Input value={companyForm.contact_person_name} onChange={(e) => setCompanyForm({ ...companyForm, contact_person_name: e.target.value })} placeholder="اسم الشخص" />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف *</Label>
                <Input value={companyForm.contact_person_phone} onChange={(e) => setCompanyForm({ ...companyForm, contact_person_phone: e.target.value })} placeholder="01012345678" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={companyForm.notes} onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })} placeholder="ملاحظات إضافية..." />
            </div>
            {selectedCompany && (
              <div className="flex items-center gap-2">
                <Switch checked={companyForm.is_active} onCheckedChange={(v) => setCompanyForm({ ...companyForm, is_active: v })} />
                <Label>نشط</Label>
              </div>
            )}
            <Button className="w-full" onClick={() => {
              if (!companyForm.name || !companyForm.city || !companyForm.contact_person_name || !companyForm.contact_person_phone) {
                toast.error('يرجى ملء جميع الحقول المطلوبة');
                return;
              }
              saveCompanyMutation.mutate();
            }} disabled={saveCompanyMutation.isPending}>
              {saveCompanyMutation.isPending ? 'جاري الحفظ...' : selectedCompany ? 'تحديث' : 'إضافة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Corporate;
