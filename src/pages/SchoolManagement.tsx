import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, CreditCard, DollarSign, GraduationCap, UserCheck, Wallet, Users } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { StaffProfilesManagement } from '@/components/corporate/StaffProfilesManagement';
import { SchoolAttendance } from '@/components/school/SchoolAttendance';
import { StaffAdvances } from '@/components/school/StaffAdvances';
import { StaffCoverage } from '@/components/school/StaffCoverage';
import { SchoolSalaries } from '@/components/school/SchoolSalaries';
import { useAuth } from '@/contexts/AuthContext';

const SchoolManagement = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { hasDepartment, isSuperAdmin } = useAuth();
  const canEdit = hasDepartment('operations') || isSuperAdmin;
  const isFinance = hasDepartment('finance') || isSuperAdmin;

  const [searchParams, setSearchParams] = useSearchParams();
  const normalizeTab = (tab: string | null) =>
    !tab || tab === 'attendance' ? 'drivers-attendance' : tab;
  const [activeTab, setActiveTab] = useState(normalizeTab(searchParams.get('tab')));

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get('tab')));
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const triggerClass = "gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHero
          icon={GraduationCap}
          title={t('schoolMgmt.title')}
          description={t('schoolMgmt.description')}
          stats={[]}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
            <TabsTrigger value="drivers-attendance" className={triggerClass}>
              <CalendarDays className="h-4 w-4" />
              {ar ? 'حضور السائقين' : 'Drivers attendance'}
            </TabsTrigger>
            <TabsTrigger value="supervisors-attendance" className={triggerClass}>
              <UserCheck className="h-4 w-4" />
              {ar ? 'حضور المشرفين' : 'Supervisors attendance'}
            </TabsTrigger>
            <TabsTrigger value="advances" className={triggerClass}>
              <Wallet className="h-4 w-4" />
              {ar ? 'السلف' : 'Advances'}
            </TabsTrigger>
            <TabsTrigger value="coverage" className={triggerClass}>
              <Users className="h-4 w-4" />
              {ar ? 'التغطية' : 'Coverage'}
            </TabsTrigger>
            <TabsTrigger value="profiles" className={triggerClass}>
              <CreditCard className="h-4 w-4" />
              {t('schoolMgmt.staffFiles')}
            </TabsTrigger>
            {isFinance && (
              <TabsTrigger value="salaries" className={triggerClass}>
                <DollarSign className="h-4 w-4" />
                {t('schoolMgmt.salaries')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="drivers-attendance">
            <SchoolAttendance canEdit={canEdit} personType="driver" />
          </TabsContent>

          <TabsContent value="supervisors-attendance">
            <SchoolAttendance canEdit={canEdit} personType="supervisor" />
          </TabsContent>

          <TabsContent value="advances">
            <StaffAdvances canEdit={isFinance || canEdit} />
          </TabsContent>

          <TabsContent value="coverage">
            <StaffCoverage canEdit={isFinance || canEdit} />
          </TabsContent>

          <TabsContent value="profiles">
            <StaffProfilesManagement canEdit={canEdit} staffContext="school" />
          </TabsContent>

          <TabsContent value="salaries">
            <SchoolSalaries canEdit={isFinance} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SchoolManagement;
