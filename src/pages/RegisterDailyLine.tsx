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
import seaterLogo from '@/assets/seater-logo.jpg';
import LineRoutePreviewMap from '@/components/daily-lines/LineRoutePreviewMap';

type Line = { id: string; name: string; city: string; description: string | null };
type Station = { id: string; line_id: string; name: string; station_type: string; station_order: number; latitude: number | null; longitude: number | null };
type Trip = {
  id: string; line_id: string; trip_date: string; departure_time: string;
  total_seats: number; available_seats: number; cash_price: number; instapay_price: number;
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
      supabase.from('daily_line_trips').select('*').eq('line_id', lineId).eq('status', 'scheduled').gte('trip_date', today).order('trip_date').order('departure_time'),
    ]).then(([{ data: st }, { data: tr }]) => {
      setStations(st ?? []);
      const now = new Date();
      const upcoming = (tr ?? []).filter((t: Trip) => {
        const dt = new Date(`${t.trip_date}T${t.departure_time}`);
        return dt.getTime() > now.getTime();
      });
      setTrips(upcoming);
    });
  }, [lineId]);

  const selectedTrip = useMemo(() => trips.find(tr => tr.id === tripId), [trips, tripId]);
  const selectedLine = useMemo(() => lines.find(l => l.id === lineId), [lines, lineId]);
  const pickupStations = useMemo(() => stations.filter(s => s.station_type !== 'dropoff'), [stations]);
  const dropoffStations = useMemo(() => stations.filter(s => s.station_type !== 'pickup'), [stations]);

  const basePrice = selectedTrip
    ? (paymentMethod === 'cash' ? Number(selectedTrip.cash_price) : Number(selectedTrip.instapay_price))
    : 0;

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
          promocode: promo || undefined,
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
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-background to-amber-500/5" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />

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
                <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0">
                  <Bus className="w-3 h-3 mr-1" />
                  Daily Line Trip
                </Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all" style={{ width: `${(stepNumber / (STEPS.length - 1)) * 100}%` }} />
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
                  {trips.length === 0 && <p className="text-sm text-muted-foreground">No upcoming trips for this line.</p>}
                  {trips.map(tr => (
                    <button
                      key={tr.id}
                      onClick={() => setTripId(tr.id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${tripId === tr.id ? 'border-orange-500 bg-orange-500/5' : 'border-border hover:border-orange-300'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 font-semibold">
                          <Calendar className="w-4 h-4 text-orange-500" />
                          {new Date(tr.trip_date).toLocaleDateString()}
                          <Clock className="w-4 h-4 text-orange-500 ml-2" />
                          {tr.departure_time.slice(0, 5)}
                        </div>
                        <Badge variant={tr.available_seats > 0 ? 'default' : 'secondary'}>
                          {tr.available_seats} / {tr.total_seats} seats
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Cash: {tr.cash_price} EGP · Instapay: {tr.instapay_price} EGP
                      </div>
                    </button>
                  ))}
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
                      if (!pickupId) setPickupId(id);
                      else if (id !== pickupId) setDropoffId(id);
                    }}
                  />
                  <div>
                    <Label>Pickup station</Label>
                    <Select value={pickupId} onValueChange={setPickupId}>
                      <SelectTrigger><SelectValue placeholder="Select pickup" /></SelectTrigger>
                      <SelectContent>
                        {pickupStations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Drop-off station</Label>
                    <Select value={dropoffId} onValueChange={setDropoffId}>
                      <SelectTrigger><SelectValue placeholder="Select drop-off" /></SelectTrigger>
                      <SelectContent>
                        {dropoffStations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Promo code (optional)</Label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={promo} onChange={e => setPromo(e.target.value)} placeholder="Enter code" className="pl-9" />
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {step === 'payment' && (
              <>
                <CardHeader><CardTitle>Payment method</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'instapay')}>
                    <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border has-[:checked]:border-orange-500 has-[:checked]:bg-orange-500/5">
                      <RadioGroupItem value="cash" id="cash" />
                      <Label htmlFor="cash" className="flex-1 flex items-center gap-2 cursor-pointer">
                        <Wallet className="w-5 h-5" /> Cash on board
                      </Label>
                      {selectedTrip && <span className="font-bold">{selectedTrip.cash_price} EGP</span>}
                    </div>
                    <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border has-[:checked]:border-orange-500 has-[:checked]:bg-orange-500/5">
                      <RadioGroupItem value="instapay" id="instapay" />
                      <Label htmlFor="instapay" className="flex-1 flex items-center gap-2 cursor-pointer">
                        <CreditCard className="w-5 h-5" /> Instapay
                      </Label>
                      {selectedTrip && <span className="font-bold">{selectedTrip.instapay_price} EGP</span>}
                    </div>
                  </RadioGroup>

                  {paymentMethod === 'instapay' && (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2 text-sm">
                      <p className="font-semibold">Send {basePrice} EGP via Instapay to:</p>
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
                            <a href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I just paid ${basePrice} EGP via Instapay for a Daily Line trip. My phone: ${phone}`)}`} target="_blank" rel="noreferrer">
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
                  <Row label="Payment" value={paymentMethod === 'cash' ? 'Cash on board' : 'Instapay'} />
                  {promo && <Row label="Promo" value={promo} />}
                  <div className="pt-3 mt-3 border-t flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold text-orange-500">{basePrice} EGP</span>
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
                <div className="text-6xl font-black tracking-wider text-orange-500">{bookingResult.boarding_code}</div>
                <p className="text-sm text-muted-foreground">Total: <span className="font-bold">{bookingResult.final_price} EGP</span></p>
                <div className="flex gap-2 justify-center pt-4">
                  <Button onClick={() => navigate('/')} variant="outline">Home</Button>
                  <Button onClick={() => navigate('/daily-line/portal')} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">View my trips</Button>
                </div>
              </CardContent>
            )}

            {step !== 'done' && (
              <CardContent className="pt-0">
                {step === 'confirm' ? (
                  <Button onClick={submit} disabled={submitting} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Confirm booking
                  </Button>
                ) : (
                  <Button onClick={goNext} disabled={!canNext()} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white">
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
