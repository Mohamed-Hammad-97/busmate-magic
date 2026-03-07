import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRight, MapPin, User, Truck, CalendarDays,
  CreditCard, DollarSign, FileText, Phone, Building2, Route,
} from 'lucide-react';
import { CompanyLinesManagement } from './CompanyLinesManagement';
import { CorporateAttendance } from './CorporateAttendance';
import { StaffProfilesManagement } from './StaffProfilesManagement';
import { SalaryManagement } from './SalaryManagement';
import { CompanyInvoices } from './CompanyInvoices';

interface CompanyDetailViewProps {
  company: any;
  onBack: () => void;
  canEdit: boolean;
  isFinance: boolean;
}

export function CompanyDetailView({ company, onBack, canEdit, isFinance }: CompanyDetailViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('lines');

  const { data: linesCount = 0 } = useQuery({
    queryKey: ['company-lines-count-detail', company.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('company_lines')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id);
      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <div className="space-y-8">
      {/* Premium Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/30 bg-card shadow-xl">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/50" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/50" />
        </div>

        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/30" />

        <div className="relative p-6 sm:p-8">
          {/* Back button row */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              onClick={onBack}
            >
              <ArrowRight className="h-4 w-4" />
              <span className="text-sm">العودة</span>
            </Button>

            {company.is_active ? (
              <Badge className="bg-success/10 text-success border-success/20 text-xs font-semibold px-4 py-1.5 rounded-full backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block me-2 animate-pulse" />
                نشط
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs px-4 py-1.5 rounded-full">
                غير نشط
              </Badge>
            )}
          </div>

          {/* Company Identity */}
          <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
            {/* Logo / Avatar */}
            <div className="relative">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-border/40 shadow-lg"
                />
              ) : (
                <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
                  <Building2 className="h-7 w-7 text-primary-foreground" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-success border-2 border-card" />
            </div>

            <div className="flex-1 min-w-0">
              <h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-1"
                style={{ fontFamily: "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif" }}
              >
                {company.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                إدارة الخطوط والرحلات
              </p>
            </div>
          </div>

          {/* Info Strip */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/30">
              <MapPin className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-medium text-foreground">{company.city}</span>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/30">
              <User className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-medium text-foreground">{company.contact_person_name}</span>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/30" dir="ltr">
              <Phone className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-medium text-foreground">{company.contact_person_phone}</span>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
              <Route className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">خطوط {linesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="relative">
          <TabsList className="w-full justify-start bg-card border border-border/40 p-1.5 rounded-2xl h-auto flex-wrap shadow-sm gap-1">
            <TabsTrigger
              value="lines"
              className="gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-200"
              style={{ fontFamily: "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif" }}
            >
              <Truck className="h-4 w-4" />
              الخطوط
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-200"
              style={{ fontFamily: "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif" }}
            >
              <CalendarDays className="h-4 w-4" />
              الحضور
            </TabsTrigger>
            <TabsTrigger
              value="profiles"
              className="gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-200"
              style={{ fontFamily: "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif" }}
            >
              <CreditCard className="h-4 w-4" />
              ملفات الموظفين
            </TabsTrigger>
            {isFinance && (
              <TabsTrigger
                value="salaries"
                className="gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-200"
                style={{ fontFamily: "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif" }}
              >
                <DollarSign className="h-4 w-4" />
                الرواتب
              </TabsTrigger>
            )}
            {isFinance && (
              <TabsTrigger
                value="invoices"
                className="gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-200"
                style={{ fontFamily: "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif" }}
              >
                <FileText className="h-4 w-4" />
                الفواتير
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="lines" className="mt-0">
            <CompanyLinesManagement company={company} onBack={() => {}} canEdit={canEdit} hideBackButton />
          </TabsContent>

          <TabsContent value="attendance" className="mt-0">
            <CorporateAttendance canEdit={canEdit} staffContext="corporate" companyId={company.id} />
          </TabsContent>

          <TabsContent value="profiles" className="mt-0">
            <StaffProfilesManagement canEdit={canEdit} staffContext="corporate" companyId={company.id} />
          </TabsContent>

          <TabsContent value="salaries" className="mt-0">
            <SalaryManagement staffContext="corporate" companyId={company.id} />
          </TabsContent>

          <TabsContent value="invoices" className="mt-0">
            <CompanyInvoices companyId={company.id} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
