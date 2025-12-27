import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Download,
  BarChart3
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, subDays, subWeeks, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  subscription_id: string;
}

interface FinancialReportsProps {
  payments: Payment[];
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({ payments }) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  
  const today = new Date();
  
  // Calculate summaries for different periods
  const summaries = useMemo(() => {
    const dailyStart = startOfDay(today);
    const dailyEnd = endOfDay(today);
    
    const weeklyStart = startOfWeek(today, { weekStartsOn: 0 });
    const weeklyEnd = endOfWeek(today, { weekStartsOn: 0 });
    
    const monthlyStart = startOfMonth(today);
    const monthlyEnd = endOfMonth(today);
    
    // Previous periods for comparison
    const prevDayStart = startOfDay(subDays(today, 1));
    const prevDayEnd = endOfDay(subDays(today, 1));
    
    const prevWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
    const prevWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
    
    const prevMonthStart = startOfMonth(subMonths(today, 1));
    const prevMonthEnd = endOfMonth(subMonths(today, 1));
    
    const calculatePeriodStats = (start: Date, end: Date) => {
      const periodPayments = payments.filter(p => {
        if (!p.paid_date) return false;
        const paidDate = parseISO(p.paid_date);
        return isWithinInterval(paidDate, { start, end });
      });
      
      return {
        collected: periodPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        count: periodPayments.length,
      };
    };
    
    const calculateDueStats = (start: Date, end: Date) => {
      const duePayments = payments.filter(p => {
        const dueDate = parseISO(p.due_date);
        return isWithinInterval(dueDate, { start, end });
      });
      
      const total = duePayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const collected = duePayments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      
      return {
        total,
        collected,
        outstanding: total - collected,
        rate: total > 0 ? Math.round((collected / total) * 100) : 0,
      };
    };
    
    return {
      daily: {
        current: calculatePeriodStats(dailyStart, dailyEnd),
        previous: calculatePeriodStats(prevDayStart, prevDayEnd),
        due: calculateDueStats(dailyStart, dailyEnd),
      },
      weekly: {
        current: calculatePeriodStats(weeklyStart, weeklyEnd),
        previous: calculatePeriodStats(prevWeekStart, prevWeekEnd),
        due: calculateDueStats(weeklyStart, weeklyEnd),
      },
      monthly: {
        current: calculatePeriodStats(monthlyStart, monthlyEnd),
        previous: calculatePeriodStats(prevMonthStart, prevMonthEnd),
        due: calculateDueStats(monthlyStart, monthlyEnd),
      },
    };
  }, [payments]);
  
  // Trend data for charts
  const trendData = useMemo(() => {
    const last30Days: Record<string, { date: string; collected: number; due: number }> = {};
    
    for (let i = 29; i >= 0; i--) {
      const date = subDays(today, i);
      const dateKey = format(date, 'yyyy-MM-dd');
      last30Days[dateKey] = { date: format(date, 'dd MMM'), collected: 0, due: 0 };
    }
    
    payments.forEach(p => {
      const dueKey = p.due_date;
      const paidKey = p.paid_date;
      
      if (dueKey && last30Days[dueKey]) {
        last30Days[dueKey].due += Number(p.amount);
      }
      
      if (paidKey && last30Days[paidKey]) {
        last30Days[paidKey].collected += Number(p.amount);
      }
    });
    
    return Object.values(last30Days);
  }, [payments]);
  
  // Outstanding payments breakdown
  const outstandingBreakdown = useMemo(() => {
    const outstanding = payments.filter(p => p.status !== 'paid');
    const overdue = outstanding.filter(p => parseISO(p.due_date) < today);
    const pending = outstanding.filter(p => parseISO(p.due_date) >= today);
    
    return {
      overdueAmount: overdue.reduce((sum, p) => sum + Number(p.amount), 0),
      overdueCount: overdue.length,
      pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount), 0),
      pendingCount: pending.length,
    };
  }, [payments]);
  
  const currentSummary = summaries[period];
  const change = currentSummary.current.collected - currentSummary.previous.collected;
  const changePercent = currentSummary.previous.collected > 0 
    ? Math.round((change / currentSummary.previous.collected) * 100) 
    : 0;
  
  const periodLabels = {
    daily: 'اليوم',
    weekly: 'هذا الأسبوع',
    monthly: 'هذا الشهر',
  };
  
  const chartConfig = {
    collected: { label: 'محصل', color: 'hsl(var(--success))' },
    due: { label: 'مستحق', color: 'hsl(var(--primary))' },
  };
  
  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">التقارير المالية</h2>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
          <TabsList>
            <TabsTrigger value="daily">يومي</TabsTrigger>
            <TabsTrigger value="weekly">أسبوعي</TabsTrigger>
            <TabsTrigger value="monthly">شهري</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              المحصل {periodLabels[period]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currentSummary.current.collected.toLocaleString()} ج.م
            </div>
            <div className="flex items-center gap-1 text-xs mt-1">
              {change >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                {changePercent > 0 ? '+' : ''}{changePercent}%
              </span>
              <span className="text-muted-foreground">عن الفترة السابقة</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              المستحق {periodLabels[period]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentSummary.due.total.toLocaleString()} ج.م
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              نسبة التحصيل: {currentSummary.due.rate}%
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">المتأخرات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {outstandingBreakdown.overdueAmount.toLocaleString()} ج.م
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {outstandingBreakdown.overdueCount} دفعة متأخرة
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">قيد الانتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {outstandingBreakdown.pendingAmount.toLocaleString()} ج.م
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {outstandingBreakdown.pendingCount} دفعة قادمة
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Collection Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">تحليل التحصيل (آخر 30 يوم)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <AreaChart data={trendData}>
              <XAxis dataKey="date" fontSize={10} tickLine={false} />
              <YAxis fontSize={10} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area 
                type="monotone" 
                dataKey="collected" 
                stroke="hsl(var(--success))" 
                fill="hsl(var(--success) / 0.2)" 
                name="محصل"
              />
              <Area 
                type="monotone" 
                dataKey="due" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary) / 0.1)" 
                name="مستحق"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
      
      {/* Collection Rate Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">معدلات التحصيل</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">يومي</p>
              <p className="text-3xl font-bold mt-1">{summaries.daily.due.rate}%</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">أسبوعي</p>
              <p className="text-3xl font-bold mt-1">{summaries.weekly.due.rate}%</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">شهري</p>
              <p className="text-3xl font-bold mt-1">{summaries.monthly.due.rate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
