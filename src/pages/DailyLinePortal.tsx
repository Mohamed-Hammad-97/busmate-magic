import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bus, LogOut, User, CreditCard, MessageCircle, Loader2, Send,
  Calendar, Clock, MapPin, CheckCircle2, AlertCircle, Upload, Receipt, Plus, Navigation,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import seaterLogo from "@/assets/seater-logo.jpg";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

const DAILY_LINE_TAG = "[DailyLine]";

export default function DailyLinePortal() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();
  const { user, parentAccount, signOut, isLoading } = useParentAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("trips");

  useEffect(() => {
    if (!isLoading && !user) navigate("/parent/auth?redirect=/daily-line/portal", { replace: true });
  }, [user, isLoading, navigate]);

  // ---------- BOOKINGS ----------
  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ["dl-bookings", parentAccount?.id, parentAccount?.father_phone],
    enabled: !!parentAccount,
    queryFn: async () => {
      if (!parentAccount) return [];
      // Match by parent_id OR by passenger_phone (covers pre-account bookings)
      const phones = [parentAccount.father_phone, parentAccount.mother_phone].filter(Boolean);
      const orParts: string[] = [`parent_id.eq.${parentAccount.id}`];
      phones.forEach((p) => orParts.push(`passenger_phone.eq.${p}`));
      const { data } = await supabase
        .from("daily_line_bookings")
        .select("*, daily_line_trips(*, daily_lines(name, city)), pickup:pickup_station_id(name, latitude, longitude), dropoff:dropoff_station_id(name, latitude, longitude)")
        .or(orParts.join(","))
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const upcoming = useMemo(
    () =>
      bookings.filter((b: any) => {
        const trip = b.daily_line_trips;
        if (!trip) return false;
        const date = new Date(`${trip.trip_date}T${trip.departure_time}`);
        return date.getTime() >= Date.now() - 4 * 60 * 60 * 1000 && b.payment_status !== "cancelled";
      }),
    [bookings],
  );
  const history = useMemo(() => bookings.filter((b: any) => !upcoming.includes(b)), [bookings, upcoming]);

  // ---------- PROFILE ----------
  const [profileForm, setProfileForm] = useState({ parent_name: "", father_phone: "", mother_phone: "" });
  useEffect(() => {
    if (parentAccount) {
      setProfileForm({
        parent_name: parentAccount.parent_name || "",
        father_phone: parentAccount.father_phone || "",
        mother_phone: parentAccount.mother_phone || "",
      });
    }
  }, [parentAccount]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!parentAccount) throw new Error("no account");
      const { error } = await supabase
        .from("parent_accounts")
        .update({
          parent_name: profileForm.parent_name,
          mother_phone: profileForm.mother_phone || null,
        })
        .eq("id", parentAccount.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: isRtl ? "تم الحفظ" : "Saved" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // ---------- CHAT ----------
  const { data: conversations = [] } = useQuery({
    queryKey: ["dl-chat-convos", parentAccount?.id],
    enabled: !!parentAccount && tab === "chat",
    queryFn: async () => {
      if (!parentAccount) return [];
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("parent_id", parentAccount.id)
        .like("subject", `${DAILY_LINE_TAG}%`)
        .order("last_message_at", { ascending: false });
      return data || [];
    },
    refetchInterval: tab === "chat" ? 5000 : false,
  });

  const [activeConv, setActiveConv] = useState<string | null>(null);
  useEffect(() => {
    if (!activeConv && conversations.length > 0) setActiveConv(conversations[0].id);
  }, [conversations, activeConv]);

  const { data: messages = [] } = useQuery({
    queryKey: ["dl-chat-msgs", activeConv],
    enabled: !!activeConv,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", activeConv!)
        .order("created_at", { ascending: true });
      return data || [];
    },
    refetchInterval: 4000,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [newMessage, setNewMessage] = useState("");
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!activeConv || !newMessage.trim() || !user) return;
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: activeConv,
        sender_type: "parent",
        sender_id: user.id,
        message: newMessage.trim(),
      });
      if (error) throw error;
      await supabase
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", activeConv);
    },
    onSuccess: () => {
      setNewMessage("");
      qc.invalidateQueries({ queryKey: ["dl-chat-msgs", activeConv] });
    },
  });

  const startConversation = useMutation({
    mutationFn: async () => {
      if (!parentAccount) throw new Error("no account");
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          parent_id: parentAccount.id,
          subject: `${DAILY_LINE_TAG} ${parentAccount.parent_name}`,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["dl-chat-convos", parentAccount?.id] });
      setActiveConv(conv.id);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // ---------- PAYMENT PROOF UPLOAD ----------
  const uploadProof = useMutation({
    mutationFn: async ({ bookingId, file }: { bookingId: string; file: File }) => {
      const path = `${parentAccount?.id || "anon"}/${bookingId}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage
        .from("daily-line-receipts")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("daily_line_bookings")
        .update({ payment_proof_url: path })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: isRtl ? "تم رفع الإيصال" : "Receipt uploaded" });
      qc.invalidateQueries({ queryKey: ["dl-bookings"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading || !parentAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={seaterLogo} alt="Seater" className="h-9 w-9 rounded-lg" />
            <div>
              <div className="text-sm font-semibold">{isRtl ? "الخطوط اليومية" : "Daily Lines"}</div>
              <div className="text-xs text-muted-foreground">{parentAccount.parent_name}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/"))}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">{isRtl ? "خروج" : "Logout"}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-5xl">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="trips" className="flex-col gap-1 py-2">
              <Bus className="h-4 w-4" /> <span className="text-xs">{isRtl ? "الرحلات" : "Trips"}</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex-col gap-1 py-2">
              <CreditCard className="h-4 w-4" /> <span className="text-xs">{isRtl ? "الدفع" : "Payment"}</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-col gap-1 py-2">
              <MessageCircle className="h-4 w-4" /> <span className="text-xs">{isRtl ? "محادثة" : "Chat"}</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex-col gap-1 py-2">
              <User className="h-4 w-4" /> <span className="text-xs">{isRtl ? "الحساب" : "Profile"}</span>
            </TabsTrigger>
          </TabsList>

          {/* TRIPS */}
          <TabsContent value="trips" className="space-y-6 mt-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{isRtl ? "الرحلات القادمة" : "Upcoming Trips"}</h2>
                <Button size="sm" asChild>
                  <Link to="/register/daily-line">
                    <Plus className="h-4 w-4 mr-1" /> {isRtl ? "حجز جديد" : "New Booking"}
                  </Link>
                </Button>
              </div>
              {loadingBookings ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : upcoming.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">{isRtl ? "لا توجد رحلات قادمة" : "No upcoming trips"}</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((b: any) => <BookingCard key={b.id} booking={b} isRtl={isRtl} />)}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">{isRtl ? "السجل" : "History"}</h2>
                <div className="space-y-3">
                  {history.slice(0, 20).map((b: any) => <BookingCard key={b.id} booking={b} isRtl={isRtl} compact />)}
                </div>
              </div>
            )}
          </TabsContent>

          {/* PAYMENT */}
          <TabsContent value="payment" className="space-y-3 mt-4">
            <h2 className="text-lg font-semibold">{isRtl ? "المدفوعات" : "Payments"}</h2>
            {bookings.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{isRtl ? "لا توجد مدفوعات" : "No payments"}</CardContent></Card>
            ) : (
              bookings.map((b: any) => (
                <Card key={b.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        {b.daily_line_trips?.daily_lines?.name} — {b.daily_line_trips?.trip_date}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {b.payment_method === "cash" ? (isRtl ? "نقدي" : "Cash") : "Instapay"} • {Number(b.final_price).toFixed(2)} EGP
                        {Number(b.discount_amount) > 0 && (
                          <span className="ml-2 text-xs">({isRtl ? "خصم" : "discount"} {Number(b.discount_amount).toFixed(2)})</span>
                        )}
                      </div>
                    </div>
                    <PaymentStatusBadge status={b.payment_status} isRtl={isRtl} />
                    {b.payment_method === "instapay" && b.payment_status === "pending" && (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadProof.mutate({ bookingId: b.id, file: f });
                          }}
                        />
                        <Button size="sm" variant="outline" asChild>
                          <span><Upload className="h-3 w-3 mr-1" />{isRtl ? "إيصال" : "Receipt"}</span>
                        </Button>
                      </label>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* CHAT */}
          <TabsContent value="chat" className="mt-4">
            <Card className="h-[60vh] flex flex-col">
              {conversations.length === 0 ? (
                <CardContent className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                  <MessageCircle className="h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">{isRtl ? "ابدأ محادثة مع خدمة العملاء" : "Start a conversation with support"}</p>
                  <Button onClick={() => startConversation.mutate()} disabled={startConversation.isPending}>
                    {startConversation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {isRtl ? "بدء محادثة" : "Start Chat"}
                  </Button>
                </CardContent>
              ) : (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {messages.map((m: any) => (
                        <div key={m.id} className={`flex ${m.sender_type === "parent" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.sender_type === "parent" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <div className="text-sm whitespace-pre-wrap">{m.message}</div>
                            <div className="text-[10px] opacity-70 mt-1">{format(new Date(m.created_at), "HH:mm")}</div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="border-t p-3 flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage.mutate()}
                      placeholder={isRtl ? "اكتب رسالة..." : "Type a message..."}
                    />
                    <Button onClick={() => sendMessage.mutate()} disabled={!newMessage.trim() || sendMessage.isPending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          {/* PROFILE */}
          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRtl ? "بياناتي" : "My Profile"}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{isRtl ? "الاسم" : "Name"}</Label>
                  <Input value={profileForm.parent_name} onChange={(e) => setProfileForm({ ...profileForm, parent_name: e.target.value })} />
                </div>
                <div>
                  <Label>{isRtl ? "رقم الهاتف الأساسي" : "Primary Phone"}</Label>
                  <Input value={profileForm.father_phone} disabled />
                  <p className="text-xs text-muted-foreground mt-1">{isRtl ? "لا يمكن تغيير الرقم الأساسي" : "Primary phone cannot be changed"}</p>
                </div>
                <div>
                  <Label>{isRtl ? "رقم احتياطي" : "Alternate Phone"}</Label>
                  <Input value={profileForm.mother_phone} onChange={(e) => setProfileForm({ ...profileForm, mother_phone: e.target.value })} />
                </div>
                <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                  {saveProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {isRtl ? "حفظ" : "Save"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PaymentStatusBadge({ status, isRtl }: { status: string; isRtl: boolean }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    paid: { label: isRtl ? "مدفوع" : "Paid", cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30", icon: CheckCircle2 },
    pending: { label: isRtl ? "قيد الانتظار" : "Pending", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", icon: Clock },
    cancelled: { label: isRtl ? "ملغي" : "Cancelled", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30", icon: AlertCircle },
  };
  const m = map[status] || map.pending;
  const Icon = m.icon;
  return <Badge variant="outline" className={m.cls}><Icon className="h-3 w-3 mr-1" />{m.label}</Badge>;
}

function BookingCard({ booking: b, isRtl, compact }: { booking: any; isRtl: boolean; compact?: boolean }) {
  const trip = b.daily_line_trips;
  const pickup = b.pickup;
  const dropoff = b.dropoff;
  const navUrl = (s: any) =>
    s?.latitude && s?.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`
      : null;
  const pickupNav = navUrl(pickup);
  const dropoffNav = navUrl(dropoff);
  const isLive = trip?.status === "in_progress";
  return (
    <Card className={`overflow-hidden transition hover:shadow-md ${isLive ? "ring-2 ring-green-500/50" : ""}`}>
      <CardContent className="p-4">
        <Link to={!compact ? `/daily-line/trip/${b.id}` : "#"} className={compact ? "pointer-events-none" : "block"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-primary" />
                <span className="font-semibold">{trip?.daily_lines?.name}</span>
                <Badge variant="secondary" className="text-xs">{trip?.daily_lines?.city}</Badge>
                {isLive && (
                  <Badge className="bg-green-500 text-[10px] animate-pulse">
                    {isRtl ? "مباشر" : "LIVE"}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{trip?.trip_date}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{trip?.departure_time?.slice(0, 5)}</span>
              </div>
              {!compact && (
                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {pickup?.name || "—"} → {dropoff?.name || "—"}
                </div>
              )}
            </div>
            <div className="text-end space-y-2">
              <PaymentStatusBadge status={b.payment_status} isRtl={isRtl} />
              <div className="text-2xl font-bold tabular-nums">{b.boarding_code}</div>
              <div className="text-[10px] text-muted-foreground">{isRtl ? "كود الركوب" : "Boarding code"}</div>
            </div>
          </div>
        </Link>
        {!compact && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            <Button size="sm" asChild className="flex-1 min-w-[140px]">
              <Link to={`/daily-line/trip/${b.id}`}>
                <Bus className="h-3 w-3 mr-1" />
                {isRtl ? "تتبع الحافلة" : "Track Bus"}
              </Link>
            </Button>
            {pickupNav && (
              <Button size="sm" variant="outline" asChild className="flex-1 min-w-[140px]">
                <a href={pickupNav} target="_blank" rel="noreferrer">
                  <Navigation className="h-3 w-3 mr-1" />
                  {isRtl ? "الذهاب لمحطة الركوب" : "Go to pickup"}
                </a>
              </Button>
            )}
            {dropoffNav && (
              <Button size="sm" variant="outline" asChild className="flex-1 min-w-[140px]">
                <a href={dropoffNav} target="_blank" rel="noreferrer">
                  <Navigation className="h-3 w-3 mr-1" />
                  {isRtl ? "محطة النزول" : "Drop-off location"}
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
