import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { CompanyDetailView } from '@/components/corporate/CompanyDetailView';

const Corporate = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { hasDepartment, isSuperAdmin } = useAuth();
  const canEdit = hasDepartment('operation_companies') || isSuperAdmin;
  const isFinance = hasDepartment('finance') || isSuperAdmin;

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'companies');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

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
        <CompanyDetailView
          company={selectedCompanyForLines}
          onBack={() => setSelectedCompanyForLines(null)}
          canEdit={canEdit}
          isFinance={isFinance}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHero
          icon={Building2}
          title={t('corporateMgmt.title')}
          description={t('corporateMgmt.description')}
          stats={[
            { icon: Building2, value: companies.length, label: t('corporateMgmt.companies') },
            { icon: TrendingUp, value: activeCompanies, label: t('corporateMgmt.active') },
            { icon: Truck, value: totalLines, label: t('corporateMgmt.lines') },
          ]}
          actions={canEdit && activeTab === 'companies' ? (
            <Button
              size="sm"
              className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm"
              onClick={() => { resetForm(); setCompanyDialogOpen(true); }}
            >
              <Plus className="h-4 w-4" />
              {t('corporateMgmt.addCompany')}
            </Button>
          ) : undefined}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
            <TabsTrigger value="companies" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Building2 className="h-4 w-4" />
              {t('corporateMgmt.companies')}
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <CalendarDays className="h-4 w-4" />
              {t('corporateMgmt.attendance')}
            </TabsTrigger>
            <TabsTrigger value="profiles" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <CreditCard className="h-4 w-4" />
              {t('corporateMgmt.staffFiles')}
            </TabsTrigger>
            {isFinance && (
              <TabsTrigger value="salaries" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                <DollarSign className="h-4 w-4" />
                {t('corporateMgmt.salaries')}
              </TabsTrigger>
            )}
            {isFinance && (
              <TabsTrigger value="invoices" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                <FileText className="h-4 w-4" />
                {t('corporateMgmt.invoices')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="companies">
            <div className="space-y-6">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('common.search') + '...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl transition-all"
                />
              </div>

              {/* Companies Cards */}
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 animate-pulse">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">{t('corporateMgmt.noCompanies')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredCompanies.map((company: any) => {
                    const lineCount = companyLines.filter((l: any) => l.company_id === company.id).length;
                    return (
                      <div
                        key={company.id}
                        className="group relative rounded-2xl border border-border/50 bg-card p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                        onClick={() => setSelectedCompanyForLines(company)}
                      >
                        {/* Decorative gradient */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20 rounded-t-2xl" />
                        
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                            {company.name}
                          </h3>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={(e) => { e.stopPropagation(); handleEdit(company); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Info rows */}
                        <div className="space-y-2.5 mb-5">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span>{company.city}</span>
                            {company.location_address && <span className="text-xs truncate">- {company.location_address}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4 shrink-0" />
                            <span>{company.contact_person_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground" dir="ltr">
                            <span className="text-xs">{company.contact_person_phone}</span>
                          </div>
                        </div>

                        {/* Footer badges */}
                        <div className="flex items-center gap-2 pt-3 border-t border-border/30">
                          {company.is_active ? (
                            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-xs font-semibold px-3 py-1 rounded-full">
                              {t('corporateMgmt.active')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs px-3 py-1 rounded-full">{t('corporateMgmt.inactive')}</Badge>
                          )}
                          <Badge variant="outline" className="text-xs font-mono px-3 py-1 rounded-full">
                            <Truck className="h-3 w-3 ml-1 rtl:ml-0 rtl:mr-1" />
                            {lineCount} {t('corporateMgmt.lines')}
                          </Badge>
                        </div>

                        {/* Hover glow effect */}
                        <div className="absolute inset-0 rounded-2xl ring-1 ring-transparent group-hover:ring-primary/20 transition-all duration-300 pointer-events-none" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attendance">
            <CorporateAttendance canEdit={canEdit} staffContext="corporate" />
          </TabsContent>

          <TabsContent value="profiles">
            <StaffProfilesManagement canEdit={canEdit} staffContext="corporate" />
          </TabsContent>

          <TabsContent value="salaries">
            <SalaryManagement staffContext="corporate" />
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
            <DialogTitle>{selectedCompany ? t('corporateMgmt.editCompany') : t('corporateMgmt.addNewCompany')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('corporateMgmt.companyName')} *</Label>
                <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('corporateMgmt.city')} *</Label>
                <Input value={companyForm.city} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('corporateMgmt.address')}</Label>
              <Input value={companyForm.location_address} onChange={(e) => setCompanyForm({ ...companyForm, location_address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('corporateMgmt.contactPerson')} *</Label>
                <Input value={companyForm.contact_person_name} onChange={(e) => setCompanyForm({ ...companyForm, contact_person_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('corporateMgmt.phone')} *</Label>
                <Input value={companyForm.contact_person_phone} onChange={(e) => setCompanyForm({ ...companyForm, contact_person_phone: e.target.value })} placeholder="01012345678" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('corporateMgmt.notes')}</Label>
              <Textarea value={companyForm.notes} onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })} />
            </div>
            {selectedCompany && (
              <div className="flex items-center gap-2">
                <Switch checked={companyForm.is_active} onCheckedChange={(v) => setCompanyForm({ ...companyForm, is_active: v })} />
                <Label>{t('corporateMgmt.active')}</Label>
              </div>
            )}
            <Button className="w-full" onClick={() => {
              if (!companyForm.name || !companyForm.city || !companyForm.contact_person_name || !companyForm.contact_person_phone) {
                toast.error(t('staff.fillRequired'));
                return;
              }
              saveCompanyMutation.mutate();
            }} disabled={saveCompanyMutation.isPending}>
              {saveCompanyMutation.isPending ? t('common.loading') : selectedCompany ? t('common.save') : t('common.add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Corporate;
