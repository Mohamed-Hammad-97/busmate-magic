import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle, Building2, User, Phone, CreditCard, MapPin, FileText } from "lucide-react";
import seaterLogo from "@/assets/seater-logo.jpg";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useGoogleMapsToken } from "@/hooks/useGoogleMapsToken";

interface CompanyLine {
  id: string;
  name: string;
  route_details: string | null;
}

const defaultCenter = { lat: 30.0444, lng: 31.2357 }; // Cairo

export default function CompanyEmployeeRegister() {
  const { companyId } = useParams<{ companyId: string }>();
  const [companyName, setCompanyName] = useState("");
  const [lines, setLines] = useState<CompanyLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [invalidCompany, setInvalidCompany] = useState(false);
  const [pickupMode, setPickupMode] = useState<"line" | "custom">("line");
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);

  const { token: mapsToken } = useGoogleMapsToken();
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: mapsToken || "",
    id: "google-map-employee-register",
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    national_id: "",
    department: "",
    company_line_id: "",
    pickup_address: "",
    notes: "",
  });

  useEffect(() => {
    if (!companyId) return;
    loadCompanyData();
  }, [companyId]);

  const loadCompanyData = async () => {
    try {
      const res = await supabase.functions.invoke("company-portal-data", {
        body: { action: "get-public-company-info", data: { company_id: companyId } },
      });

      if (res.data?.error || !res.data?.company) {
        setInvalidCompany(true);
      } else {
        setCompanyName(res.data.company.name);
        setLines(res.data.lines || []);
        if (!res.data.lines?.length) setPickupMode("custom");
      }
    } catch {
      setInvalidCompany(true);
    } finally {
      setLoading(false);
    }
  };

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPos({ lat, lng });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      setError("Name and phone number are required");
      return;
    }
    if (pickupMode === "custom" && !markerPos) {
      setError("Please select your pickup location on the map");
      return;
    }
    if (pickupMode === "line" && !form.company_line_id) {
      setError("Please select a transport line");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const body: any = {
        company_id: companyId,
        full_name: form.full_name,
        phone: form.phone,
        national_id: form.national_id || null,
        department: form.department || null,
        notes: form.notes || null,
        pickup_address: form.pickup_address || null,
      };

      if (pickupMode === "line") {
        body.company_line_id = form.company_line_id;
      } else {
        body.company_line_id = null;
        if (markerPos) {
          body.pickup_latitude = markerPos.lat;
          body.pickup_longitude = markerPos.lng;
        }
      }

      const { data, error: fnError } = await supabase.functions.invoke("company-employee-register", { body });
      if (fnError) throw fnError;
      if (data?.error) { setError(data.error); return; }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invalidCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="py-12 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground">This link is invalid or the company is inactive</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Registered Successfully!</h2>
            <p className="text-muted-foreground">
              Your data has been submitted to {companyName}. You will be contacted soon.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src={seaterLogo} alt="Seater" className="h-14 w-14 mx-auto rounded-xl shadow-lg" />
          <div>
            <h1 className="text-2xl font-bold">Employee Registration</h1>
            <p className="text-muted-foreground mt-1">
              <Building2 className="inline h-4 w-4 mr-1" />
              {companyName}
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="border-0 shadow-xl">
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-4 w-4 text-primary" />
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Enter your full name" className="h-11" required />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Phone className="h-4 w-4 text-primary" />
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="01xxxxxxxxx" className="h-11" dir="ltr" required />
              </div>

              {/* National ID */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-primary" />
                  National ID
                </Label>
                <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                  placeholder="Enter national ID" className="h-11" dir="ltr" />
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-primary" />
                  Department
                </Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Human Resources" className="h-11" />
              </div>

              {/* Pickup Mode Selection */}
              {lines.length > 0 && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    Pickup Method
                  </Label>
                  <RadioGroup value={pickupMode} onValueChange={(v) => setPickupMode(v as "line" | "custom")} className="grid grid-cols-2 gap-3">
                    <Label htmlFor="mode-line" className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                      pickupMode === "line" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}>
                      <RadioGroupItem value="line" id="mode-line" />
                      <span className="text-sm font-medium">Select a Line</span>
                    </Label>
                    <Label htmlFor="mode-custom" className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                      pickupMode === "custom" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}>
                      <RadioGroupItem value="custom" id="mode-custom" />
                      <span className="text-sm font-medium">Custom Pickup</span>
                    </Label>
                  </RadioGroup>
                </div>
              )}

              {/* Line Selection */}
              {pickupMode === "line" && lines.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Transport Line</Label>
                  <Select value={form.company_line_id} onValueChange={(v) => setForm({ ...form, company_line_id: v })}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Choose a line" /></SelectTrigger>
                    <SelectContent>
                      {lines.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.name} {line.route_details ? `- ${line.route_details}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom Pickup with Map */}
              {(pickupMode === "custom" || lines.length === 0) && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Pickup Location</Label>
                  <p className="text-xs text-muted-foreground">Tap on the map to set your pickup point</p>
                  {mapsLoaded ? (
                    <div className="rounded-xl overflow-hidden border border-border/50 h-[250px]">
                      <GoogleMap
                        mapContainerStyle={{ width: "100%", height: "100%" }}
                        center={markerPos || defaultCenter}
                        zoom={12}
                        onClick={onMapClick}
                        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                      >
                        {markerPos && <Marker position={markerPos} />}
                      </GoogleMap>
                    </div>
                  ) : (
                    <div className="h-[250px] rounded-xl bg-muted/50 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {markerPos && (
                    <p className="text-xs text-muted-foreground">
                      📍 {markerPos.lat.toFixed(5)}, {markerPos.lng.toFixed(5)}
                    </p>
                  )}

                  {/* Address (optional) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Address (optional)</Label>
                    <Input value={form.pickup_address} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                      placeholder="Enter your detailed address" className="h-11" />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="h-4 w-4 text-primary" />
                  Notes
                </Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes..." rows={3} />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
              )}

              <Button type="submit" className="w-full h-12 text-base font-medium" disabled={submitting}>
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit Registration"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by Seater — Smart Transport Services
        </p>
      </div>
    </div>
  );
}
