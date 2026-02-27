import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRight, MapPin, User, Truck, CalendarDays,
  CreditCard, DollarSign, FileText,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={onBack}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{company.city}</span>
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{company.contact_person_name}</span>
            <span dir="ltr">{company.contact_person_phone}</span>
          </div>
        </div>
        {company.is_active ? (
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1 rounded-full">نشط</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs px-3 py-1 rounded-full">غير نشط</Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="lines" className="gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Truck className="h-4 w-4" />
            الخطوط
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

        <TabsContent value="lines">
          <CompanyLinesManagement company={company} onBack={() => {}} canEdit={canEdit} hideBackButton />
        </TabsContent>

        <TabsContent value="attendance">
          <CorporateAttendance canEdit={canEdit} staffContext="corporate" companyId={company.id} />
        </TabsContent>

        <TabsContent value="profiles">
          <StaffProfilesManagement canEdit={canEdit} staffContext="corporate" companyId={company.id} />
        </TabsContent>

        <TabsContent value="salaries">
          <SalaryManagement staffContext="corporate" companyId={company.id} />
        </TabsContent>

        <TabsContent value="invoices">
          <CompanyInvoices companyId={company.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}