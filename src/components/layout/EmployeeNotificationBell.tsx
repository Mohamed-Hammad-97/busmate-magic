import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, ClipboardList } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const cityMapping: Record<string, string[]> = {
  cairo: ['cairo', 'القاهرة', 'قاهرة'],
  giza: ['giza', 'الجيزة', 'جيزة'],
  alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية'],
};

function normalizeCityGroup(city: string | null): string {
  if (!city) return 'unknown';
  const lower = city.toLowerCase();
  for (const [key, variants] of Object.entries(cityMapping)) {
    if (variants.some(v => lower.includes(v))) return key;
  }
  return lower;
}

export function EmployeeNotificationBell() {
  const { user, employee, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const employeeCityGroups = (
    (employee?.cities && employee.cities.length ? employee.cities : (employee?.city ? [employee.city] : [])) as string[]
  ).map(normalizeCityGroup).filter(Boolean);


  const { data: notifications = [] } = useQuery({
    queryKey: ["employee-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Filter by city client-side
  const filteredNotifications = notifications.filter((n: any) => {
    if (isSuperAdmin) return true;
    if (!employeeCityGroups.length) return true;
    return employeeCityGroups.includes(normalizeCityGroup(n.city));
  });


  const unreadCount = filteredNotifications.filter(
    (n: any) => !n.read_by?.includes(user?.id)
  ).length;

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = filteredNotifications
        .filter((n: any) => !n.read_by?.includes(user?.id))
        .map((n: any) => n.id);
      
      if (unreadIds.length === 0) return;

      // Update each notification to add user to read_by array
      for (const id of unreadIds) {
        const notification = filteredNotifications.find((n: any) => n.id === id);
        const currentReadBy = notification?.read_by || [];
        await supabase
          .from("employee_notifications")
          .update({ read_by: [...currentReadBy, user?.id] })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-notifications"] });
    },
  });

  // Subscribe to realtime
  useEffect(() => {
    const channel = supabase
      .channel("employee-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "employee_notifications" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["employee-notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      markReadMutation.mutate();
    }
  };

  const handleNotificationClick = (notification: any) => {
    setOpen(false);
    navigate("/registrations");
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>
        <ScrollArea className="h-72">
          {filteredNotifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((n: any) => {
                const isUnread = !n.read_by?.includes(user?.id);
                return (
                  <div
                    key={n.id}
                    className={`p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${isUnread ? 'bg-primary/5' : ''}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">📋</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
