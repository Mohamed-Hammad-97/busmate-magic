import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, User, UserCircle, Bus, Loader2 } from "lucide-react";

export type StaffTarget = {
  id: string;
  full_name: string;
  contact: string;
  type: "employee" | "supervisor" | "driver";
  user_id?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (staff: StaffTarget) => void;
  isPending?: boolean;
}

const TABS: { value: StaffTarget["type"]; label: string }[] = [
  { value: "employee", label: "Employees" },
  { value: "supervisor", label: "Supervisors" },
  { value: "driver", label: "Drivers" },
];

export function StaffPickerDialog({ open, onOpenChange, onSelect, isPending }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<StaffTarget["type"]>("employee");
  const [search, setSearch] = useState("");

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["chat-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, email, phone, departments, city, user_id, is_active")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["chat-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, full_name, phone")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ["chat-supervisors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisors")
        .select("id, full_name, phone")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const list: (StaffTarget & { meta?: string })[] =
    tab === "employee"
      ? employees
          .filter((e: any) => e.user_id !== user?.id)
          .map((e: any) => ({
            id: e.id,
            full_name: e.full_name,
            contact: e.phone || e.email,
            type: "employee" as const,
            user_id: e.user_id,
            meta: [(e.departments || []).join(", "), e.city].filter(Boolean).join(" • "),
          }))
      : tab === "supervisor"
      ? supervisors.map((s: any) => ({ id: s.id, full_name: s.full_name, contact: s.phone, type: "supervisor" as const }))
      : drivers.map((d: any) => ({ id: d.id, full_name: d.full_name, contact: d.phone, type: "driver" as const }));

  const term = search.trim().toLowerCase();
  const filtered = list.filter(
    (p) => !term || p.full_name?.toLowerCase().includes(term) || (p.contact || "").toLowerCase().includes(term)
  );

  const icon = (type: StaffTarget["type"]) =>
    type === "employee" ? <UserCircle className="h-5 w-5 text-primary" /> : type === "driver" ? <Bus className="h-5 w-5 text-green-600" /> : <User className="h-5 w-5 text-blue-600" />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>New Staff Chat</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.value ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-1.5 p-1">
            {loadingEmployees && tab === "employee" ? (
              <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No results</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={`${p.type}-${p.id}`}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left disabled:opacity-60"
                  onClick={() => onSelect(p)}
                  disabled={isPending}
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">{icon(p.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate" dir="ltr">{p.contact}</p>
                    {p.meta && <p className="text-[11px] text-muted-foreground/80 truncate">{p.meta}</p>}
                  </div>
                  <Badge variant="outline" className="capitalize text-xs shrink-0">{p.type}</Badge>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
