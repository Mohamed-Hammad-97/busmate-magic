import { etaFor, stationMinutesMap, isStationUpcoming, cairoNow } from '@/lib/stationEta';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bus, MapPin, Calendar, Clock, Tag, CreditCard, Wallet, CheckCircle2, Upload, MessageCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import PageSeo from '@/components/seo/PageSeo';
import seaterLogo from '@/assets/seater-logo.jpg';
import LineRoutePreviewMap from '@/components/daily-lines/LineRoutePreviewMap';

type Line = { id: string; name: string; city: string; description: string | null };
type Station = { id: string; line_id: string; name: string; station_type: string; station_order: number; latitude: number | null; longitude: number | null; minutes_from_start?: number | null };
type Trip = {
  id: string; line_id: string; trip_date: string; departure_time: string;
  total_seats: number; available_seats: number; cash_price: number; instapay_price: number; status?: string;
};

const STEPS = ['contact', 'line', 'trip', 'stations', 'payment', 'confirm', 'done'] as const;
type Step = typeof STEPS[number];

const RegisterDailyLine: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const [step, setStep] = useState<Step>('contact');
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [lineId, setLineId] = useState('');
  const [tripId, setTripId] = useState('');
  const [pickupId, setPickupId] = useState('');
  const [dropoffId, setDropoffId] = useState('');
  const [promo, setPromo] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; promo_type: 'percentage' | 'fixed'; value: number } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay'>('cash');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [bookingResult, setBookingResult] = useState<{ id: string; boarding_code: string; final_price: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: c }, settingsResp] = await Promise.all([
        supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
        supabase.functions.invoke('get-daily-line-payment-info'),
      ]);
      setCities(c ?? []);
      const payload = (settingsResp?.data ?? {}) as { settings?: Record<string, string> };
      setSettings(payload.settings ?? {});
    })();
  }, []);

  // Load lines when city changes
  useEffect(() => {
    if (!city) { setLines([]); setLineId(''); return; }
    supabase.from('daily_lines').select('*').eq('is_active', true).eq('city', city).order('name')
      .then(({ data }) => setLines(data ?? []));
  }, [city]);

  // Load stations + upcoming trips when line changes
  useEffect(() => {
    if (!lineId) { setStations([]); setTrips([]); return; }
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      supabase.from('daily_line_stations').select('*').eq('line_id', lineId).eq('is_active', true).order('station_order'),
      supabase.from('daily_line_trips').select('id, line_id, trip_date, departure_time, total_seats, available_seats, cash_price, instapay_price, status, created_at, updated_at').eq('line_id', lineId).in('status', ['scheduled', 'in_progress']).gt('available_seats', 0).gte('trip_date', today).order('trip_date').order('departure_time'),
    ]).then(([{ data: st }, { data: tr }]) => {
      setStations(st ?? []);
      const mins = stationMinutesMap((st ?? []) as Station[]);
      const pickups = ((st ?? []) as Station[]).filter(s => s.station_type !== 'dropoff');
      // Keep a trip while at least one pickup station is still ahead of the bus.
      const upcoming = (tr ?? []).filter((t: Trip) =>
        pickups.some(s => isStationUpcoming(t.trip_date, t.departure_time, mins[s.id])));
      setTrips(upcoming);
    });
  }, [lineId]);

  const [dayFilter, setDayFilter] = useState<string>('all');
  useEffect(() => { setDayFilter('all'); }, [lineId]);
  const tripDays = useMemo(() => Array.from(new Set(trips.map(t => t.trip_date))), [trips]);
  const visibleTrips = useMemo(() => dayFilter === 'all' ? trips : trips.filter(t => t.trip_date === dayFilter), [trips, dayFilter]);
  useEffect(() => { if (tripId && !visibleTrips.some(t => t.id === tripId)) setTripId(''); }, [visibleTrips, tripId]);
  const locale = isRtl ? 'ar-EG' : 'en-GB';
  const dayLabel = (d: string) => {
    const today = cairoNow().date;
    const diff = Math.round((Date.parse(d) - Date.parse(today)) / 86400000);
    if (diff === 0) return isRtl ? 'اليوم' : 'Today';
    if (diff === 1) return isRtl ? 'غداً' : 'Tomorrow';
    return new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  };
  const fullDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  const selectedTrip = useMemo(() => trips.find(tr => tr.id === tripId), [trips, tripId]);
  const selectedLine = useMemo(() => lines.find(l => l.id === lineId), [lines, lineId]);
  const stationMins = useMemo(() => stationMinutesMap(stations), [stations]);
  const depTime = trips.find(t => t.id === tripId)?.departure_time;
  const etaOf = (id: string) => etaFor(depTime, stationMins[id]);
  const pickupStations = useMemo(() => stations.filter(s => s.station_type !== 'dropoff'
    && (!selectedTrip || isStationUpcoming(selectedTrip.trip_date, selectedTrip.departure_time, stationMins[s.id]))), [stations, selectedTrip, stationMins]);
  const pickupOrder = stations.find(s => s.id === pickupId)?.station_order;
  const dropoffStations = useMemo(() => stations.filter(s => s.station_type !== 'pickup'
    && (pickupOrder == null || s.station_order > pickupOrder)), [stations, pickupOrder]);
  useEffect(() => {
    if (pickupId && !pickupStations.some(s => s.id === pickupId)) setPickupId('');
    if (dropoffId && !dropoffStations.some(s => s.id === dropoffId)) setDropoffId('');
  }, [pickupStations, dropoffStations, pickupId, dropoffId]);

  const basePrice = selectedTrip
    ? (paymentMethod === 'cash' ? Number(selectedTrip.cash_price) : Number(selectedTrip.instapay_price))
    : 0;
  const discountFor = (price: number) => {
    if (!appliedPromo) return 0;
    const d = appliedPromo.promo_type === 'percentage'
      ? Math.round(price * appliedPromo.value) / 100
      : appliedPromo.value;
    return Math.min(d, price);
  };
  const discount = discountFor(basePrice);
  const finalPrice = Math.max(0, basePrice - discount);
  const PriceTag = ({ price }: { price: number }) => {
    const d = discountFor(price);
    return d > 0 ? (
      <span className="text-right">
        <span className="text-xs line-through text-muted-foreground mr-1">{price}</span>
        <span className="font-bold text-green-600">{price - d} EGP</span>
      </span>
    ) : <span className="font-bold">{price} EGP</span>;
  };

  const applyPromo = async () => {
    const code = promo.trim();
    if (!code) return;
    setPromoChecking(true);
    setPromoError('');
    try {
      const { data } = await supabase.functions.invoke('daily-line-validate-promo', { body: { code } });
      const r = data as { valid: boolean; reason?: string; code?: string; promo_type?: 'percentage' | 'fixed'; value?: number };
      if (r?.valid && r.code && r.promo_type && r.value != null) {
        setAppliedPromo({ code: r.code, promo_type: r.promo_type, value: r.value });
      } else {
        setAppliedPromo(null);
        setPromoError(r?.reason === 'expired' ? 'هذا الكود منتهي الصلاحية' : r?.reason === 'used_up' ? 'تم استخدام هذا الكود بالكامل' : 'كود الخصم غير صحيح');
      }
    } catch {
      setPromoError('تعذر التحقق من الكود، حاول مرة أخرى');
    } finally {
      setPromoChecking(false);
    }
  };

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };
  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const canNext = (): boolean => {
    switch (step) {
      case 'contact': return name.trim().length > 1 && phone.trim().length >= 8;
      case 'line': return !!city && !!lineId;
      case 'trip': return !!tripId;
      case 'stations': return !!pickupId && !!dropoffId && pickupId !== dropoffId;
      case 'payment': return !!paymentMethod;
      case 'confirm': return true;
      default: return false;
    }
  };

  const submit = async () => {
    if (!selectedTrip) return;
    setSubmitting(true);
    try {
      let proof_file_base64: string | null = null;
      let proof_file_ext: string | null = null;
      let proof_file_type: string | null = null;
      if (proofFile) {
        proof_file_ext = proofFile.name.split('.').pop() || 'jpg';
        proof_file_type = proofFile.type || 'application/octet-stream';
        proof_file_base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Strip data URL prefix
            resolve(result.includes(',') ? result.split(',')[1] : result);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(proofFile);
        });
      }
      const { data, error } = await supabase.functions.invoke('daily-line-book', {
        body: {
          trip_id: tripId,
          passenger_name: name,
          passenger_phone: phone,
          pickup_station_id: pickupId,
          dropoff_station_id: dropoffId,
          payment_method: paymentMethod,
          promocode: appliedPromo?.code || undefined,
          proof_file_base64,
          proof_file_ext,
          proof_file_type,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setBookingResult((data as { booking: { id: string; boarding_code: string; final_price: number } }).booking);
      setStep('done');
    } catch (e) {
      toast({ title: t('common.error'), description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const stepNumber = STEPS.indexOf(step) + 1;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <PageSeo
        title="Daily Line Trip Booking | Seater"
        description="Book a seat on a scheduled Seater daily line trip. Pay with cash or Instapay and track your ride in real time."
        path="/register/daily-line"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={seaterLogo} alt="Seater" className="h-10 w-auto rounded-xl shadow-md" />
            <span className="font-bold text-lg hidden sm:inline">Seater</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      <main className="relative pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <Button variant="ghost" size="sm" onClick={() => step === 'contact' || step === 'done' ? navigate('/') : goBack()} className="mb-4">
            {isRtl ? <ArrowRight className="w-4 h-4 ml-2" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
            {t('common.back')}
          </Button>

          {step !== 'done' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{t('common.step', 'Step')} {stepNumber} / {STEPS.length - 1}</span>
                <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">
                  <Bus className="w-3 h-3 mr-1" />
                  Daily Line Trip
                </Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(stepNumber / (STEPS.length - 1)) * 100}%` }} />
              </div>
            </div>
          )}

          <Card className="border-2 shadow-xl">
            {step === 'contact' && (
              <>
                <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone number</Label>
                    <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
                  </div>
                </CardContent>
              </>
            )}

            {step === 'line' && (
              <>
                <CardHeader><CardTitle>Choose city & line</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>City</Label>
                    <Select value={city} onValueChange={(v) => { setCity(v); setLineId(''); }}>
                      <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                      <SelectContent>
                        {cities.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Line</Label>
                    <Select value={lineId} onValueChange={setLineId} disabled={!city}>
                      <SelectTrigger><SelectValue placeholder={city ? 'Select line' : 'Select city first'} /></SelectTrigger>
                      <SelectContent>
                        {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {city && lines.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-2">No lines available in this city yet.</p>
                    )}
                  </div>
                  {selectedLine?.description && (
                    <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">{selectedLine.description}</p>
                  )}
                </CardContent>
              </>
            )}

            {step === 'trip' && (
              <>
                <CardHeader><CardTitle>Pick a trip</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {trips.length === 0 && <p className="text-sm text-muted-foreground">{isRtl ? 'لا توجد رحلات قادمة لهذا الخط' : 'No upcoming trips for this line.'}</p>}
                  {tripDays.length > 0 && (
                    <div className="-mx-6 px-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {(['all', ...tripDays] as string[]).map(d => {
                        const active = dayFilter === d;
                        return (
                          <button key={d} type="button" onClick={() => setDayFilter(d)}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'}`}>
                            {d === 'all' ? (isRtl ? 'الكل' : 'All') : dayLabel(d)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {visibleTrips.map((tr, i) => {
                    const sel = tripId === tr.id;
                    const showHeader = dayFilter === 'all' && (i === 0 || visibleTrips[i - 1].trip_date !== tr.trip_date);
                    return (
                      <React.Fragment key={tr.id}>
                        {showHeader && <p className="pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{fullDate(tr.trip_date)}</p>}
                        <button type="button" onClick={() => setTripId(tr.id)}
                          className={`relative w-full text-start p-4 rounded-2xl border-2 transition-all ${sel ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/40'}`}>
                          {sel && <CheckCircle2 className="absolute top-3 end-3 w-5 h-5 text-primary" />}
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-2xl font-extrabold text-foreground">
                                <Clock className="w-5 h-5 text-primary" />{tr.departure_time.slice(0, 5)}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{fullDate(tr.trip_date)}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0 pe-6">
                              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{isRtl ? 'كاش' : 'Cash'} {tr.cash_price}</span>
                              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Instapay {tr.instapay_price}</span>
                            </div>
                          </div>
                          {(tr.status === 'in_progress' || tr.available_seats <= 4) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {tr.status === 'in_progress' && <Badge className="bg-green-600 text-white border-0">جارية الآن · Ongoing</Badge>}
                              {tr.available_seats <= 4 && (
                                <span className="rounded-full bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 text-xs font-bold text-orange-600">
                                  {tr.available_seats === 1 ? 'باقي مقعد واحد فقط · Only 1 seat left' : `باقي ${tr.available_seats} مقاعد فقط · Only ${tr.available_seats} seats left`}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </CardContent>
              </>
            )}

            {step === 'stations' && (
              <>
                <CardHeader><CardTitle>Pickup & drop-off</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <LineRoutePreviewMap
                    stations={stations as any}
                    height="240px"
                    highlightStationId={pickupId || dropoffId || undefined}
                    onStationClick={(id) => {
                      // tap on a marker selects it as pickup if not set, otherwise dropoff
                      if (!pickupId) { if (pickupStations.some(s => s.id === id)) setPickupId(id); }
                      else if (dropoffStations.some(s => s.id === id)) setDropoffId(id);
                    }}
                  />
                  <div>
                    <Label>Pickup station</Label>
                    <Select value={pickupId} onValueChange={setPickupId}>
                      <SelectTrigger><SelectValue placeholder="Select pickup" /></SelectTrigger>
                      <SelectContent>
                        {pickupStations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{etaOf(s.id) ? ` (${etaOf(s.id)})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Drop-off station</Label>
                    <Select value={dropoffId} onValueChange={setDropoffId}>
                      <SelectTrigger><SelectValue placeholder="Select drop-off" /></SelectTrigger>
                      <SelectContent>
                        {dropoffStations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{etaOf(s.id) ? ` (${etaOf(s.id)})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {(() => {
                    const dep = trips.find(t => t.id === tripId)?.departure_time;
                    const pu = etaFor(dep, stationMins[pickupId]);
                    const dr = etaFor(dep, stationMins[dropoffId]);
                    if (!pu && !dr) return null;
                    return (
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                        <div><div className="text-xs text-muted-foreground">موعد الركوب المتوقع · Est. pickup</div><div className="font-bold">{pu ?? '—'}</div></div>
                        <div><div className="text-xs text-muted-foreground">موعد الوصول المتوقع · Est. arrival</div><div className="font-bold">{dr ?? '—'}</div></div>
                        <div className="col-span-2 text-[11px] text-muted-foreground">أوقات تقديرية · Estimated times</div>
                      </div>
                    );
                  })()}
                  <div>
                    <Label>Promo code (optional)</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={promo} onChange={e => { setPromo(e.target.value); setAppliedPromo(null); setPromoError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } }} placeholder="Enter code" className="pl-9" />
                      </div>
                      {appliedPromo ? (
                        <Button type="button" variant="outline" onClick={() => { setAppliedPromo(null); setPromo(''); }}>Remove</Button>
                      ) : (
                        <Button type="button" onClick={applyPromo} disabled={!promo.trim() || promoChecking}>
                          {promoChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                        </Button>
                      )}
                    </div>
                    {appliedPromo && (
                      <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        تم تطبيق الخصم: {appliedPromo.promo_type === 'percentage' ? `${appliedPromo.value}%` : `${appliedPromo.value} EGP`}
                      </p>
                    )}
                    {promoError && <p className="mt-2 text-sm text-destructive">{promoError}</p>}
                  </div>
                </CardContent>
              </>
            )}

            {step === 'payment' && (
              <>
                <CardHeader><CardTitle>Payment method</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'instapay')}>
                    <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <RadioGroupItem value="cash" id="cash" />
                      <Label htmlFor="cash" className="flex-1 flex items-center gap-2 cursor-pointer">
                        <Wallet className="w-5 h-5" /> Cash on board
                      </Label>
                      {selectedTrip && <PriceTag price={Number(selectedTrip.cash_price)} />}
                    </div>
                    <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <RadioGroupItem value="instapay" id="instapay" />
                      <Label htmlFor="instapay" className="flex-1 flex items-center gap-2 cursor-pointer">
                        <CreditCard className="w-5 h-5" /> Instapay
                      </Label>
                      {selectedTrip && <PriceTag price={Number(selectedTrip.instapay_price)} />}
                    </div>
                  </RadioGroup>

                  {paymentMethod === 'instapay' && (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2 text-sm">
                      <p className="font-semibold">Send {finalPrice} EGP via Instapay to:</p>
                      <div>Account: <span className="font-mono">{settings.instapay_account_name || '—'}</span></div>
                      <div>IPA: <span className="font-mono">{settings.instapay_ipa || '—'}</span></div>
                      <div>Bank: <span className="font-mono">{settings.instapay_bank_name || '—'}</span></div>
                      {settings.instapay_instructions && <p className="text-muted-foreground">{settings.instapay_instructions}</p>}

                      <div className="pt-3 space-y-2">
                        <Label>Upload payment screenshot</Label>
                        <Input type="file" accept="image/*" onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                        <p className="text-xs text-muted-foreground">— or —</p>
                        {settings.whatsapp_number && (
                          <Button asChild variant="outline" className="w-full">
                            <a href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I just paid ${finalPrice} EGP via Instapay for a Daily Line trip. My phone: ${phone}`)}`} target="_blank" rel="noreferrer">
                              <MessageCircle className="w-4 h-4 mr-2" /> Send proof on WhatsApp
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            )}

            {step === 'confirm' && selectedTrip && (
              <>
                <CardHeader><CardTitle>Confirm your booking</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Name" value={name} />
                  <Row label="Phone" value={phone} />
                  <Row label="Line" value={selectedLine?.name ?? ''} />
                  <Row label="Date" value={new Date(selectedTrip.trip_date).toLocaleDateString()} />
                  <Row label="Time" value={selectedTrip.departure_time.slice(0, 5)} />
                  <Row label="Pickup" value={stations.find(s => s.id === pickupId)?.name ?? ''} />
                  <Row label="Drop-off" value={stations.find(s => s.id === dropoffId)?.name ?? ''} />
                  {etaFor(selectedTrip.departure_time, stationMins[pickupId]) && <Row label="Est. pickup time" value={etaFor(selectedTrip.departure_time, stationMins[pickupId])!} />}
                  {etaFor(selectedTrip.departure_time, stationMins[dropoffId]) && <Row label="Est. arrival time" value={etaFor(selectedTrip.departure_time, stationMins[dropoffId])!} />}
                  <Row label="Payment" value={paymentMethod === 'cash' ? 'Cash on board' : 'Instapay'} />
                  {appliedPromo && <Row label="Promo" value={appliedPromo.code} />}
                  {discount > 0 && <Row label="Original price" value={`${basePrice} EGP`} />}
                  {discount > 0 && <Row label="Discount" value={`- ${discount} EGP`} />}
                  <div className="pt-3 mt-3 border-t flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">{finalPrice} EGP</span>
                  </div>
                </CardContent>
              </>
            )}

            {step === 'done' && bookingResult && (
              <CardContent className="py-12 text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold">Booking confirmed!</h2>
                <p className="text-muted-foreground">Show your boarding code to the driver:</p>
                <div className="text-6xl font-black tracking-wider text-primary">{bookingResult.boarding_code}</div>
                <p className="text-sm text-muted-foreground">Total: <span className="font-bold">{bookingResult.final_price} EGP</span></p>
                <div className="flex gap-2 justify-center pt-4">
                  <Button onClick={() => navigate('/')} variant="outline">Home</Button>
                  <Button onClick={() => navigate(`/parent/auth?redirect=/daily-line/portal&phone=${encodeURIComponent(phone.trim())}`)} className="bg-primary text-primary-foreground hover:bg-primary/90">View my trips</Button>
                </div>
              </CardContent>
            )}

            {step !== 'done' && (
              <CardContent className="pt-0">
                {step === 'confirm' ? (
                  <Button onClick={submit} disabled={submitting} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Confirm booking
                  </Button>
                ) : (
                  <Button onClick={goNext} disabled={!canNext()} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Next {isRtl ? <ArrowLeft className="w-4 h-4 ml-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value}</span>
  </div>
);

export default RegisterDailyLine;
