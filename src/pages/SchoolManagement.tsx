import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, CreditCard, DollarSign, GraduationCap } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { CorporateAttendance } from '@/components/corporate/CorporateAttendance';
import { StaffProfilesManagement } from '@/components/corporate/StaffProfilesManagement';
import { SalaryManagement } from '@/components/corporate/SalaryManagement';
import { useAuth } from '@/contexts/AuthContext';

const SchoolManagement = () => {
  const { hasDepartment, isSuperAdmin } = useAuth();
  const canEdit = hasDepartment('operations') || isSuperAdmin;
  const isFinance = hasDepartment('finance') || isSuperAdmin;
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'attendance');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHero
          icon={GraduationCap}
          title="إدارة المدارس"
          description="متابعة الحضور وملفات الموظفين والرواتب لسائقي المدارس"
          stats={[]}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
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
          </TabsList>

          <TabsContent value="attendance">
            <CorporateAttendance canEdit={canEdit} staffContext="school" />
          </TabsContent>

          <TabsContent value="profiles">
            <StaffProfilesManagement canEdit={canEdit} staffContext="school" />
          </TabsContent>

          <TabsContent value="salaries">
            <SalaryManagement staffContext="school" />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SchoolManagement;
