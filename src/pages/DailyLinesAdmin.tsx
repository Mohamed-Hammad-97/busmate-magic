import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bus, MapPin, CalendarDays, Sparkles, ClipboardList, Plus, Trash2,
  Pencil, Loader2, CheckCircle2, XCircle, Eye, CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import LineMapEditor from "@/components/daily-lines/LineMapEditor";
import LineRoutePreviewMap from "@/components/daily-lines/LineRoutePreviewMap";

export default function DailyLinesAdmin() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "lines";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <DashboardLayout>
      <PageHero
        title={isRtl ? "الخطوط اليومية" : "Daily Lines"}
        description={isRtl ? "إدارة الخطوط، المحطات، الرحلات، والحجوزات" : "Manage lines, stations, trips, bookings"}
        icon={Bus}
      />
      <div className="container mx-auto p-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="lines"><MapPin className="h-4 w-4 mr-1" />{isRtl ? "الخطوط" : "Lines"}</TabsTrigger>
            <TabsTrigger value="trips"><CalendarDays className="h-4 w-4 mr-1" />{isRtl ? "الرحلات" : "Trips"}</TabsTrigger>
            <TabsTrigger value="bookings"><ClipboardList className="h-4 w-4 mr-1" />{isRtl ? "الحجوزات" : "Bookings"}</TabsTrigger>
            <TabsTrigger value="promocodes"><Sparkles className="h-4 w-4 mr-1" />{isRtl ? "أكواد خصم" : "Promocodes"}</TabsTrigger>
            <TabsTrigger value="settings"><CreditCard className="h-4 w-4 mr-1" />{isRtl ? "إعدادات الدفع" : "Payment"}</TabsTrigger>
          </TabsList>
          <TabsContent value="lines" className="mt-4"><LinesTab isRtl={isRtl} /></TabsContent>
          <TabsContent value="trips" className="mt-4"><TripsTab isRtl={isRtl} /></TabsContent>
          <TabsContent value="bookings" className="mt-4"><BookingsTab isRtl={isRtl} /></TabsContent>
          <TabsContent value="promocodes" className="mt-4"><PromocodesTab isRtl={isRtl} /></TabsContent>
          <TabsContent value="settings" className="mt-4"><SettingsTab isRtl={isRtl} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ============================ LINES + STATIONS ============================ */
function LinesTab({ isRtl }: { isRtl: boolean }) {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [stationsLineId, setStationsLineId] = useState<string | null>(null);
  const [previewLineId, setPreviewLineId] = useState<string | null>(null);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["dla-lines"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_lines").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });
  const { data: cities = [] } = useQuery({
    queryKey: ["dla-cities"],
    queryFn: async () => (await supabase.from("cities").select("id,name").eq("is_active", true)).data || [],
  });

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing?.id) {
        const { error } = await supabase.from("daily_lines").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("daily_lines").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dla-lines"] });
      setOpen(false); setEditing(null);
      toast({ title: isRtl ? "تم الحفظ" : "Saved" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dla-lines"] });
      toast({ title: isRtl ? "تم الحذف" : "Deleted" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" />{isRtl ? "خط جديد" : "New Line"}</Button>
          </DialogTrigger>
          <LineDialog editing={editing} cities={cities} onSubmit={(f) => save.mutate(f)} saving={save.isPending} isRtl={isRtl} />
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRtl ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{isRtl ? "المدينة" : "City"}</TableHead>
                  <TableHead>{isRtl ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-end">{isRtl ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.city}</TableCell>
                    <TableCell><Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? (isRtl ? "نشط" : "Active") : (isRtl ? "متوقف" : "Inactive")}</Badge></TableCell>
                    <TableCell className="text-end space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setStationsLineId(l.id)}><MapPin className="h-3 w-3 mr-1" />{isRtl ? "محطات" : "Stations"}</Button>
                      <Button size="sm" variant="outline" onClick={() => setPreviewLineId(l.id)}><Eye className="h-3 w-3 mr-1" />{isRtl ? "معاينة" : "Preview"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                      {isSuperAdmin && (<Button size="sm" variant="ghost" onClick={() => { if (confirm(isRtl ? "حذف؟" : "Delete?")) remove.mutate(l.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>)}
                    </TableCell>
                  </TableRow>
                ))}
                {lines.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{isRtl ? "لا توجد خطوط" : "No lines yet"}</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!stationsLineId} onOpenChange={(o) => { if (!o) { setStationsLineId(null); qc.invalidateQueries({ queryKey: ["dla-lines"] }); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{isRtl ? "محطات الخط على الخريطة" : "Line Stations on Map"}</DialogTitle></DialogHeader>
          {stationsLineId && <LineMapEditor lineId={stationsLineId} isRtl={isRtl} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewLineId} onOpenChange={(o) => !o && setPreviewLineId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{isRtl ? "معاينة الخط" : "Line Preview"}</DialogTitle></DialogHeader>
          {previewLineId && <LinePreviewBlock lineId={previewLineId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LinePreviewBlock({ lineId }: { lineId: string }) {
  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["dla-line-preview", lineId],
    queryFn: async () => (await supabase.from("daily_line_stations").select("*").eq("line_id", lineId).order("station_order")).data || [],
  });
  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  return <LineRoutePreviewMap stations={stations as any} height="500px" />;
}

function LineDialog({ editing, cities, onSubmit, saving, isRtl }: any) {
  const [form, setForm] = useState({ name: "", city: "", description: "", is_active: true });
  useEffect(() => {
    setForm(editing ? { name: editing.name, city: editing.city, description: editing.description || "", is_active: editing.is_active } : { name: "", city: "", description: "", is_active: true });
  }, [editing]);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? (isRtl ? "تعديل خط" : "Edit Line") : (isRtl ? "خط جديد" : "New Line")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>{isRtl ? "الاسم" : "Name"}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>{isRtl ? "المدينة" : "City"}</Label>
          <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
            <SelectTrigger><SelectValue placeholder={isRtl ? "اختر مدينة" : "Select city"} /></SelectTrigger>
            <SelectContent>{cities.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>{isRtl ? "الوصف" : "Description"}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>{isRtl ? "نشط" : "Active"}</Label></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={!form.name || !form.city || saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{isRtl ? "حفظ" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}


/* ============================ TRIPS ============================ */
function TripsTab({ isRtl }: { isRtl: boolean }) {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: lines = [] } = useQuery({
    queryKey: ["dla-lines-active"],
    queryFn: async () => (await supabase.from("daily_lines").select("id,name,city").eq("is_active", true)).data || [],
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["dla-drivers"],
    queryFn: async () =>
      (await supabase
        .from("drivers")
        .select("id,full_name,categories")
        .eq("is_active", true)
        .contains("categories", ["daily_lines"])
      ).data || [],
  });
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["dla-trips"],
    queryFn: async () => (await supabase.from("daily_line_trips").select("*, daily_lines(name, city), drivers:driver_id(full_name)").order("trip_date", { ascending: false }).limit(200)).data || [],
  });

  const save = useMutation({
    mutationFn: async (form: any) => {
      const payload = { ...form, available_seats: form.total_seats };
      if (editing?.id) {
        delete payload.available_seats; // don't reset on edit
        const { error } = await supabase.from("daily_line_trips").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("daily_line_trips").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dla-trips"] }); setOpen(false); setEditing(null); toast({ title: isRtl ? "تم الحفظ" : "Saved" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("daily_line_trips").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dla-trips"] }); toast({ title: isRtl ? "تم الحذف" : "Deleted" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" />{isRtl ? "رحلة جديدة" : "New Trip"}</Button></DialogTrigger>
          <TripDialog editing={editing} lines={lines} drivers={drivers} onSubmit={(f) => save.mutate(f)} saving={save.isPending} isRtl={isRtl} />
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{isRtl ? "الخط" : "Line"}</TableHead>
              <TableHead>{isRtl ? "التاريخ" : "Date"}</TableHead>
              <TableHead>{isRtl ? "الوقت" : "Time"}</TableHead>
              <TableHead>{isRtl ? "السائق" : "Driver"}</TableHead>
              <TableHead>{isRtl ? "المقاعد" : "Seats"}</TableHead>
              <TableHead>{isRtl ? "السعر" : "Price"}</TableHead>
              <TableHead>{isRtl ? "الحالة" : "Status"}</TableHead>
              <TableHead className="text-end"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {trips.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell><div className="font-medium">{t.daily_lines?.name}</div><div className="text-xs text-muted-foreground">{t.daily_lines?.city}</div></TableCell>
                  <TableCell>{t.trip_date}</TableCell>
                  <TableCell>{t.departure_time?.slice(0, 5)}</TableCell>
                  <TableCell>{t.drivers?.full_name || <span className="text-muted-foreground text-xs">{isRtl ? "غير معين" : "Unassigned"}</span>}</TableCell>
                  <TableCell>{t.available_seats}/{t.total_seats}</TableCell>
                  <TableCell className="text-xs">C: {t.cash_price} / I: {t.instapay_price}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{t.status}</Badge></TableCell>
                  <TableCell className="text-end space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                    {isSuperAdmin && (<Button size="sm" variant="ghost" onClick={() => { if (confirm(isRtl ? "حذف؟" : "Delete?")) remove.mutate(t.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>)}
                  </TableCell>
                </TableRow>
              ))}
              {trips.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{isRtl ? "لا توجد رحلات" : "No trips"}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}

function TripDialog({ editing, lines, drivers, onSubmit, saving, isRtl }: any) {
  const [form, setForm] = useState<any>({
    line_id: "", trip_date: "", departure_time: "", driver_id: null,
    total_seats: 14, cash_price: 0, instapay_price: 0, status: "scheduled", notes: "",
  });
  useEffect(() => {
    setForm(editing ? {
      line_id: editing.line_id, trip_date: editing.trip_date, departure_time: editing.departure_time?.slice(0, 5),
      driver_id: editing.driver_id, total_seats: editing.total_seats, cash_price: editing.cash_price,
      instapay_price: editing.instapay_price, status: editing.status, notes: editing.notes || "",
    } : { line_id: "", trip_date: "", departure_time: "", driver_id: null, total_seats: 14, cash_price: 0, instapay_price: 0, status: "scheduled", notes: "" });
  }, [editing]);
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? (isRtl ? "تعديل رحلة" : "Edit Trip") : (isRtl ? "رحلة جديدة" : "New Trip")}</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[70vh] overflow-auto">
        <div><Label>{isRtl ? "الخط" : "Line"}</Label>
          <Select value={form.line_id} onValueChange={(v) => setForm({ ...form, line_id: v })}>
            <SelectTrigger><SelectValue placeholder={isRtl ? "اختر خط" : "Pick line"} /></SelectTrigger>
            <SelectContent>{lines.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.city})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{isRtl ? "التاريخ" : "Date"}</Label><Input type="date" value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} /></div>
          <div><Label>{isRtl ? "الوقت" : "Time"}</Label><Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} /></div>
        </div>
        <div><Label>{isRtl ? "السائق" : "Driver"}</Label>
          <Select value={form.driver_id || "none"} onValueChange={(v) => setForm({ ...form, driver_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{isRtl ? "غير معين" : "Unassigned"}</SelectItem>
              {drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>{isRtl ? "المقاعد" : "Seats"}</Label><Input type="number" value={form.total_seats} onChange={(e) => setForm({ ...form, total_seats: Number(e.target.value) })} /></div>
          <div><Label>{isRtl ? "نقدي" : "Cash"}</Label><Input type="number" step="0.01" value={form.cash_price} onChange={(e) => setForm({ ...form, cash_price: Number(e.target.value) })} /></div>
          <div><Label>Instapay</Label><Input type="number" step="0.01" value={form.instapay_price} onChange={(e) => setForm({ ...form, instapay_price: Number(e.target.value) })} /></div>
        </div>
        <div><Label>{isRtl ? "الحالة" : "Status"}</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">scheduled</SelectItem>
              <SelectItem value="in_progress">in_progress</SelectItem>
              <SelectItem value="completed">completed</SelectItem>
              <SelectItem value="cancelled">cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>{isRtl ? "ملاحظات" : "Notes"}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={!form.line_id || !form.trip_date || !form.departure_time || saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{isRtl ? "حفظ" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ============================ BOOKINGS ============================ */
function BookingsTab({ isRtl }: { isRtl: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tripFilter, setTripFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewing, setViewing] = useState<any>(null);

  const { data: trips = [] } = useQuery({
    queryKey: ["dla-trips-list"],
    queryFn: async () => (await supabase.from("daily_line_trips").select("id, trip_date, departure_time, daily_lines(name)").order("trip_date", { ascending: false }).limit(100)).data || [],
  });
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["dla-bookings", tripFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from("daily_line_bookings").select("*, daily_line_trips(trip_date, departure_time, daily_lines(name))").order("created_at", { ascending: false }).limit(500);
      if (tripFilter !== "all") q = q.eq("trip_id", tripFilter);
      if (statusFilter !== "all") q = q.eq("payment_status", statusFilter as any);
      const { data } = await q;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: any) => {
      const update: any = { payment_status: status };
      if (status === "paid") update.marked_paid_at = new Date().toISOString();
      const { error } = await supabase.from("daily_line_bookings").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dla-bookings"] }); toast({ title: isRtl ? "تم التحديث" : "Updated" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">{isRtl ? "الرحلة" : "Trip"}</Label>
          <Select value={tripFilter} onValueChange={setTripFilter}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRtl ? "الكل" : "All"}</SelectItem>
              {trips.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.daily_lines?.name} — {t.trip_date} {t.departure_time?.slice(0, 5)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">{isRtl ? "حالة الدفع" : "Payment status"}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRtl ? "الكل" : "All"}</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="paid">paid</SelectItem>
              <SelectItem value="cancelled">cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{isRtl ? "الكود" : "Code"}</TableHead>
              <TableHead>{isRtl ? "الراكب" : "Passenger"}</TableHead>
              <TableHead>{isRtl ? "الرحلة" : "Trip"}</TableHead>
              <TableHead>{isRtl ? "السعر" : "Price"}</TableHead>
              <TableHead>{isRtl ? "الدفع" : "Payment"}</TableHead>
              <TableHead>{isRtl ? "الحالة" : "Status"}</TableHead>
              <TableHead className="text-end"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bookings.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-bold text-lg">{b.boarding_code}</TableCell>
                  <TableCell><div className="font-medium">{b.passenger_name}</div><div className="text-xs text-muted-foreground">{b.passenger_phone}</div></TableCell>
                  <TableCell className="text-xs">{b.daily_line_trips?.daily_lines?.name}<br/>{b.daily_line_trips?.trip_date} {b.daily_line_trips?.departure_time?.slice(0, 5)}</TableCell>
                  <TableCell>{Number(b.final_price).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{b.payment_method}</Badge></TableCell>
                  <TableCell>
                    <Select value={b.payment_status} onValueChange={(v) => updateStatus.mutate({ id: b.id, status: v })}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">pending</SelectItem>
                        <SelectItem value="paid">paid</SelectItem>
                        <SelectItem value="cancelled">cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(b)}><Eye className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {bookings.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{isRtl ? "لا توجد حجوزات" : "No bookings"}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isRtl ? "تفاصيل الحجز" : "Booking Details"}</DialogTitle></DialogHeader>
          {viewing && <BookingDetail b={viewing} isRtl={isRtl} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingDetail({ b, isRtl }: { b: any; isRtl: boolean }) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  useEffect(() => {
    if (b.payment_proof_url) {
      supabase.storage.from("daily-line-receipts").createSignedUrl(b.payment_proof_url, 3600)
        .then(({ data }) => setProofUrl(data?.signedUrl || null));
    }
  }, [b]);
  return (
    <div className="space-y-2 text-sm">
      <Row k={isRtl ? "كود الركوب" : "Boarding code"} v={<span className="font-mono text-2xl font-bold">{b.boarding_code}</span>} />
      <Row k={isRtl ? "الراكب" : "Passenger"} v={`${b.passenger_name} (${b.passenger_phone})`} />
      <Row k={isRtl ? "السعر الأصلي" : "Original price"} v={`${b.original_price} EGP`} />
      <Row k={isRtl ? "الخصم" : "Discount"} v={`${b.discount_amount} EGP`} />
      <Row k={isRtl ? "السعر النهائي" : "Final price"} v={`${b.final_price} EGP`} />
      <Row k={isRtl ? "طريقة الدفع" : "Payment"} v={b.payment_method} />
      <Row k={isRtl ? "الحالة" : "Status"} v={b.payment_status} />
      {b.boarded_at && <Row k={isRtl ? "تم الركوب" : "Boarded at"} v={format(new Date(b.boarded_at), "PPp")} />}
      {b.dropped_at && <Row k={isRtl ? "تم النزول" : "Dropped at"} v={format(new Date(b.dropped_at), "PPp")} />}
      {proofUrl && <div><Label>{isRtl ? "إيصال الدفع" : "Payment proof"}</Label><img src={proofUrl} alt="proof" className="w-full max-h-64 object-contain border rounded mt-1" /></div>}
    </div>
  );
}
const Row = ({ k, v }: any) => <div className="flex justify-between gap-3 py-1 border-b last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;

/* ============================ PROMOCODES ============================ */
function PromocodesTab({ isRtl }: { isRtl: boolean }) {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["dla-promos"],
    queryFn: async () => (await supabase.from("daily_line_promocodes").select("*").order("created_at", { ascending: false })).data || [],
  });

  const save = useMutation({
    mutationFn: async (form: any) => {
      const payload = { ...form, code: form.code.toUpperCase(), expires_at: form.expires_at || null, max_uses: form.max_uses || null };
      if (editing?.id) { const { error } = await supabase.from("daily_line_promocodes").update(payload).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("daily_line_promocodes").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dla-promos"] }); setOpen(false); setEditing(null); toast({ title: isRtl ? "تم الحفظ" : "Saved" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("daily_line_promocodes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dla-promos"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" />{isRtl ? "كود جديد" : "New Code"}</Button></DialogTrigger>
          <PromoDialog editing={editing} onSubmit={(f) => save.mutate(f)} saving={save.isPending} isRtl={isRtl} />
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{isRtl ? "الكود" : "Code"}</TableHead>
              <TableHead>{isRtl ? "النوع" : "Type"}</TableHead>
              <TableHead>{isRtl ? "القيمة" : "Value"}</TableHead>
              <TableHead>{isRtl ? "الاستخدام" : "Usage"}</TableHead>
              <TableHead>{isRtl ? "تنتهي" : "Expires"}</TableHead>
              <TableHead>{isRtl ? "نشط" : "Active"}</TableHead>
              <TableHead className="text-end"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {codes.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-bold">{c.code}</TableCell>
                  <TableCell>{c.promo_type}</TableCell>
                  <TableCell>{c.value}{c.promo_type === "percentage" ? "%" : " EGP"}</TableCell>
                  <TableCell>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</TableCell>
                  <TableCell>{c.expires_at || "—"}</TableCell>
                  <TableCell>{c.is_active ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  <TableCell className="text-end space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                    {isSuperAdmin && (<Button size="sm" variant="ghost" onClick={() => { if (confirm(isRtl ? "حذف؟" : "Delete?")) remove.mutate(c.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>)}
                  </TableCell>
                </TableRow>
              ))}
              {codes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{isRtl ? "لا توجد أكواد" : "No promocodes"}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}

function PromoDialog({ editing, onSubmit, saving, isRtl }: any) {
  const [form, setForm] = useState<any>({ code: "", promo_type: "percentage", value: 10, max_uses: "", expires_at: "", is_active: true });
  useEffect(() => {
    setForm(editing ? { code: editing.code, promo_type: editing.promo_type, value: editing.value, max_uses: editing.max_uses || "", expires_at: editing.expires_at || "", is_active: editing.is_active } : { code: "", promo_type: "percentage", value: 10, max_uses: "", expires_at: "", is_active: true });
  }, [editing]);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? (isRtl ? "تعديل كود" : "Edit Code") : (isRtl ? "كود جديد" : "New Code")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>{isRtl ? "الكود" : "Code"}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER10" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{isRtl ? "النوع" : "Type"}</Label>
            <Select value={form.promo_type} onValueChange={(v) => setForm({ ...form, promo_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">{isRtl ? "نسبة" : "Percentage"}</SelectItem>
                <SelectItem value="fixed">{isRtl ? "مبلغ ثابت" : "Fixed"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>{isRtl ? "القيمة" : "Value"}</Label><Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{isRtl ? "حد الاستخدام" : "Max uses"}</Label><Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : "" })} placeholder={isRtl ? "بلا حد" : "Unlimited"} /></div>
          <div><Label>{isRtl ? "ينتهي في" : "Expires"}</Label><Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>{isRtl ? "نشط" : "Active"}</Label></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={!form.code || !form.value || saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{isRtl ? "حفظ" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ============================ PAYMENT SETTINGS ============================ */
function SettingsTab({ isRtl }: { isRtl: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({
    instapay_account_name: "",
    instapay_ipa: "",
    instapay_bank_name: "",
    instapay_instructions: "",
    whatsapp_number: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["dla-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_line_settings").select("key, value");
      return data || [];
    },
  });

  useEffect(() => {
    if (!rows) return;
    const map: Record<string, string> = { ...form };
    rows.forEach((r: { key: string; value: string | null }) => { map[r.key] = r.value ?? ""; });
    setForm(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const save = async () => {
    setSaving(true);
    try {
      const upserts = Object.entries(form).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from("daily_line_settings").upsert(upserts, { onConflict: "key" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["dla-settings"] });
      toast({ title: isRtl ? "تم الحفظ" : "Saved" });
    } catch (e) {
      toast({ title: isRtl ? "خطأ" : "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>{isRtl ? "بيانات Instapay" : "Instapay Bank Details"}</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <div>
          <Label>{isRtl ? "اسم صاحب الحساب" : "Account holder name"}</Label>
          <Input value={form.instapay_account_name} onChange={(e) => setForm({ ...form, instapay_account_name: e.target.value })} placeholder="Seater Co." />
        </div>
        <div>
          <Label>{isRtl ? "عنوان Instapay (IPA)" : "Instapay address (IPA)"}</Label>
          <Input value={form.instapay_ipa} onChange={(e) => setForm({ ...form, instapay_ipa: e.target.value })} placeholder="seater@instapay" />
        </div>
        <div>
          <Label>{isRtl ? "اسم البنك" : "Bank name"}</Label>
          <Input value={form.instapay_bank_name} onChange={(e) => setForm({ ...form, instapay_bank_name: e.target.value })} placeholder="CIB" />
        </div>
        <div>
          <Label>{isRtl ? "تعليمات إضافية" : "Additional instructions"}</Label>
          <Textarea value={form.instapay_instructions} onChange={(e) => setForm({ ...form, instapay_instructions: e.target.value })} rows={3} />
        </div>
        <div>
          <Label>{isRtl ? "رقم واتساب لإرسال الإيصال" : "WhatsApp number for receipts"}</Label>
          <Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="201xxxxxxxxx" />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{isRtl ? "حفظ" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
