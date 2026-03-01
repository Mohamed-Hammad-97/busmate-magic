import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Bus, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const TYPE_ICONS: Record<string, string> = {
  trip_started: "🚌",
  trip_completed: "✅",
  trip_cancelled: "❌",
};

export function CompanyNotificationBell() {
  const { token } = useCompanyAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["company-portal", "get-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "get-notifications" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!token,
    refetchInterval: 15000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "mark-notifications-read" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-portal", "get-notifications"] });
    },
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      markReadMutation.mutate();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">الإشعارات</h3>
        </div>
        <ScrollArea className="h-72">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              لا توجد إشعارات
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n: any) => (
                <div key={n.id} className={`p-3 text-sm ${!n.is_read ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">{TYPE_ICONS[n.notification_type] || "📢"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
