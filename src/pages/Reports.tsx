import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  Bus,
  FileText,
  Download,
  DollarSign
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ar } from "date-fns/locale";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { FinancialReports } from "@/components/reports/FinancialReports";
import { useCity } from "@/contexts/CityContext";

const Reports = () => {
  const { selectedCity } = useCity();
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });

  // City filter helper
  const cityMapping: Record<string, string[]> = {
    cairo: ['cairo', 'القاهرة', 'قاهرة'],
    giza: ['giza', 'الجيزة', 'جيزة'],
    alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
  };

  // Fetch trip logs
  const { data: allTripLogs = [] } = useQuery({
    queryKey: ["trip-logs", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_logs")
        .select(`
          *,
          routes (name, schools (name, city))
        `)
        .gte("trip_date", dateRange.start)
        .lte("trip_date", dateRange.end)
        .order("trip_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter trip logs by city
  const tripLogs = useMemo(() => {
    if (selectedCity === 'all') return allTripLogs;
    const cityNames = cityMapping[selectedCity] || [];
    return allTripLogs.filter((t: any) => {
      const city = t.routes?.schools?.city;
      return cityNames.some((name) => city?.toLowerCase().includes(name.toLowerCase()));
    });
  }, [allTripLogs, selectedCity]);

  // Fetch attendance records
  const { data: allAttendance = [] } = useQuery({
    queryKey: ["attendance", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          *,
          registrations (student_name, parent_accounts (city)),
          trip_logs (trip_date, routes (name))
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Filter attendance by city
  const attendance = useMemo(() => {
    if (selectedCity === 'all') return allAttendance;
    const cityNames = cityMapping[selectedCity] || [];
    return allAttendance.filter((a: any) => {
      const city = a.registrations?.parent_accounts?.city;
      return cityNames.some((name) => city?.toLowerCase().includes(name.toLowerCase()));
    });
  }, [allAttendance, selectedCity]);

  // Fetch incident reports
  const { data: allIncidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_reports")
        .select(`
          *,
          routes (name, schools (city))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter incidents by city
  const incidents = useMemo(() => {
    if (selectedCity === 'all') return allIncidents;
    const cityNames = cityMapping[selectedCity] || [];
    return allIncidents.filter((i: any) => {
      const city = i.routes?.schools?.city;
      return cityNames.some((name) => city?.toLowerCase().includes(name.toLowerCase()));
    });
  }, [allIncidents, selectedCity]);

  // Fetch payments for financial analytics
  const { data: allPayments = [] } = useQuery({
    queryKey: ["payments-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          subscriptions (
            registrations (
              parent_accounts (city)
            )
          )
        `)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Filter payments by city
  const payments = useMemo(() => {
    if (selectedCity === 'all') return allPayments;
    const cityNames = cityMapping[selectedCity] || [];
    return allPayments.filter((p: any) => {
      const city = p.subscriptions?.registrations?.parent_accounts?.city;
      return cityNames.some((name) => city?.toLowerCase().includes(name.toLowerCase()));
    });
  }, [allPayments, selectedCity]);

  // Calculate KPIs
  const totalTrips = tripLogs.length;
  const onTimeTrips = tripLogs.filter((t: any) => t.arrival_time && t.departure_time).length;
  const onTimePercentage = totalTrips > 0 ? Math.round((onTimeTrips / totalTrips) * 100) : 0;
  
  const totalAttendance = attendance.length;
  const presentCount = attendance.filter((a: any) => a.present).length;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const totalPayments = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const paidPayments = payments.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const collectionRate = totalPayments > 0 ? Math.round((paidPayments / totalPayments) * 100) : 0;

  // Chart data for payments by month
  const paymentsByMonth = payments.reduce((acc: Record<string, { paid: number; pending: number }>, p: any) => {
    const month = format(new Date(p.due_date), "MMM yyyy");
    if (!acc[month]) acc[month] = { paid: 0, pending: 0 };
    if (p.status === "paid") {
      acc[month].paid += Number(p.amount);
    } else {
      acc[month].pending += Number(p.amount);
    }
    return acc;
  }, {});

  const revenueChartData = Object.entries(paymentsByMonth).map(([month, data]) => ({
    month,
    paid: data.paid,
    pending: data.pending,
  }));

  // Incident severity data
  const incidentsBySeverity = incidents.reduce((acc: Record<string, number>, i: any) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {});

  const severityChartData = [
    { name: "منخفض", value: incidentsBySeverity["low"] || 0, color: "hsl(var(--success))" },
    { name: "متوسط", value: incidentsBySeverity["medium"] || 0, color: "hsl(var(--warning))" },
    { name: "عالي", value: incidentsBySeverity["high"] || 0, color: "hsl(var(--destructive))" },
  ];

  const chartConfig = {
    paid: { label: "مدفوع", color: "hsl(var(--success))" },
    pending: { label: "معلق", color: "hsl(var(--warning))" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">التقارير والتحليلات</h1>
          <p className="text-muted-foreground">لوحة تحكم شاملة للأداء والإحصائيات</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">نسبة الالتزام بالمواعيد</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onTimePercentage}%</div>
              <p className="text-xs text-muted-foreground">{onTimeTrips} من {totalTrips} رحلة</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">نسبة الحضور</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendanceRate}%</div>
              <p className="text-xs text-muted-foreground">{presentCount} من {totalAttendance} سجل</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">نسبة التحصيل</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{collectionRate}%</div>
              <p className="text-xs text-muted-foreground">{paidPayments.toLocaleString()} من {totalPayments.toLocaleString()} ج.م</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">الحوادث</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{incidents.length}</div>
              <p className="text-xs text-muted-foreground">
                {incidents.filter((i: any) => !i.resolved).length} غير محلول
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>تحليل الإيرادات الشهرية</CardTitle>
              <CardDescription>المدفوعات المحصلة والمعلقة</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <BarChart data={revenueChartData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="paid" fill="hsl(var(--success))" name="مدفوع" />
                  <Bar dataKey="pending" fill="hsl(var(--warning))" name="معلق" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>تصنيف الحوادث</CardTitle>
              <CardDescription>حسب درجة الخطورة</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <PieChart>
                  <Pie
                    data={severityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {severityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Reports Tabs */}
        <Tabs defaultValue="financial" className="space-y-4">
          <TabsList>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              التقارير المالية
            </TabsTrigger>
            <TabsTrigger value="trips">سجل الرحلات</TabsTrigger>
            <TabsTrigger value="attendance">الحضور</TabsTrigger>
            <TabsTrigger value="incidents">الحوادث</TabsTrigger>
          </TabsList>

          <TabsContent value="financial">
            <FinancialReports payments={payments} />
          </TabsContent>

          <TabsContent value="trips">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>سجل الرحلات اليومية</CardTitle>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
                      className="w-auto"
                    />
                    <Input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
                      className="w-auto"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المسار</TableHead>
                      <TableHead className="text-right">وقت المغادرة</TableHead>
                      <TableHead className="text-right">وقت الوصول</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tripLogs.slice(0, 20).map((trip: any) => (
                      <TableRow key={trip.id}>
                        <TableCell>
                          {format(new Date(trip.trip_date), "dd MMM yyyy", { locale: ar })}
                        </TableCell>
                        <TableCell>{trip.routes?.name || "-"}</TableCell>
                        <TableCell>{trip.departure_time || "-"}</TableCell>
                        <TableCell>{trip.arrival_time || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {trip.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>سجل الحضور</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المسار</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.slice(0, 20).map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.registrations?.student_name || "-"}</TableCell>
                        <TableCell>
                          {record.trip_logs?.trip_date 
                            ? format(new Date(record.trip_logs.trip_date), "dd MMM yyyy", { locale: ar })
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{record.trip_logs?.routes?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={record.present ? "default" : "destructive"}>
                            {record.present ? "حاضر" : "غائب"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {record.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incidents">
            <Card>
              <CardHeader>
                <CardTitle>تقارير الحوادث</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المسار</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">الخطورة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident: any) => (
                      <TableRow key={incident.id}>
                        <TableCell>
                          {format(new Date(incident.created_at), "dd MMM yyyy", { locale: ar })}
                        </TableCell>
                        <TableCell>{incident.routes?.name || "-"}</TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {incident.description}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              incident.severity === "high" ? "destructive" : 
                              incident.severity === "medium" ? "secondary" : "outline"
                            }
                          >
                            {incident.severity === "high" ? "عالي" : 
                             incident.severity === "medium" ? "متوسط" : "منخفض"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={incident.resolved ? "default" : "secondary"}>
                            {incident.resolved ? "محلول" : "قيد المعالجة"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
