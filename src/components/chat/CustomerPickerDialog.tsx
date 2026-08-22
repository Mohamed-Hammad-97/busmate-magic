import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCity } from "@/contexts/CityContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, Loader2, Phone, GraduationCap } from "lucide-react";

export interface CustomerTarget {
  id: string;
  parent_name: string;
  father_phone: string;
  mother_phone: string | null;
  payment_phone: string | null;
  city: string;
  user_id: string | null;
  students: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: CustomerTarget) => void;
  isPending?: boolean;
}

const CITY_MAPPING: Record<string, string[]> = {
  cairo: ["cairo", "القاهرة", "قاهرة"],
  giza: ["giza", "الجيزة", "جيزة"],
  alexandria: ["alexandria", "الإسكندرية", "اسكندرية", "إسكندرية"],
};

export function CustomerPickerDialog({ open, onOpenChange, onSelect, isPending }: Props) {
  const { selectedCity, allowedCities, cityLabels } = useCity();
  const [cityFilter, setCityFilter] = useState<string>(selectedCity);
  const [search, setSearch] = useState("");

  const cityOptions = useMemo(() => {
    const base = allowedCities.length ? allowedCities : (["all", "cairo", "giza", "alexandria"] as const);
    return base as readonly string[];
  }, [allowedCities]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["chat-customers-with-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_accounts")
        .select("id, parent_name, father_phone, mother_phone, payment_phone, city, user_id, registrations(student_name, status)")
        .order("parent_name");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        parent_name: c.parent_name,
        father_phone: c.father_phone,
        mother_phone: c.mother_phone,
        payment_phone: c.payment_phone,
        city: c.city,
        user_id: c.user_id,
        students: (c.registrations || [])
          .filter((r: any) => r.status !== "cancelled")
          .map((r: any) => r.student_name)
          .filter(Boolean),
      })) as CustomerTarget[];
    },
    enabled: open,
  });

  const term = search.trim().toLowerCase();

  const filtered = customers.filter((c) => {
    const cityNames = CITY_MAPPING[cityFilter];
    const matchCity =
      cityFilter === "all" || !cityNames
        ? allowedCities.length === 0 ||
          allowedCities.some((ac) => (CITY_MAPPING[ac] || []).some((n) => c.city?.toLowerCase().includes(n.toLowerCase())))
        : cityNames.some((n) => c.city?.toLowerCase().includes(n.toLowerCase()));

    if (!matchCity) return false;
    if (!term) return true;
    return (
      c.parent_name?.toLowerCase().includes(term) ||
      (c.father_phone || "").includes(term) ||
      (c.mother_phone || "").includes(term) ||
      (c.payment_phone || "").includes(term) ||
      c.students.some((s) => s.toLowerCase().includes(term))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>New Customer Chat</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, phone number, or student name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl"
            />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              {allowedCities.length === 0 && <SelectItem value="all">{cityLabels.all.en}</SelectItem>}
              {cityOptions
                .filter((c) => c !== "all")
                .map((c) => (
                  <SelectItem key={c} value={c}>
                    {(cityLabels as any)[c]?.en || c}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[58vh]">
          <div className="space-y-1.5 p-1">
            {isLoading ? (
              <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-16">No customers found</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border border-border/40 hover:bg-muted/60 transition-colors text-left disabled:opacity-60"
                  onClick={() => onSelect(c)}
                  disabled={isPending}
                >
                  <div className="h-11 w-11 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0 grid sm:grid-cols-3 gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.parent_name}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{c.city}</Badge>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span dir="ltr" className="truncate">{c.father_phone}</span>
                      </div>
                      {c.mother_phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0 opacity-60" />
                          <span dir="ltr" className="truncate">{c.mother_phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      {c.students.length ? (
                        <div className="flex items-start gap-1 text-xs text-muted-foreground">
                          <GraduationCap className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{c.students.join("، ")}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">No students</span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
