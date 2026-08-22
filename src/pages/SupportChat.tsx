import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  MessageCircle, Send, Search, Loader2, User, Plus, Phone,
  ArrowLeft, CheckCircle, UserCircle, Users, Bus, Headphones,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { StaffPickerDialog, StaffTarget } from "@/components/chat/StaffPickerDialog";
import { CustomerPickerDialog, CustomerTarget } from "@/components/chat/CustomerPickerDialog";

type ChatCategory = "all" | "staff_dm" | "customer_dm" | "customer_support" | "customer_supervisor" | "route_group" | "legacy";


interface UnifiedConv {
  id: string;
  type: string;
  subject: string | null;
  last_message_at: string | null;
  allow_customer_messages: boolean | null;
  route_id: string | null;
  conversation_participants?: any[];
}

export default function SupportChat() {
  const { user, employee } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState<ChatCategory>("all");
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New chat dialogs
  const [showNewStaffChat, setShowNewStaffChat] = useState(false);
  const [showNewCustomerChat, setShowNewCustomerChat] = useState(false);
  const [showNewGroupChat, setShowNewGroupChat] = useState(false);

  // ---- Data fetching ----
  const { data: unifiedConvs = [], isLoading: loadingUnified } = useQuery({
    queryKey: ["all-unified-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_conversations")
        .select("*, conversation_participants(*)")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as UnifiedConv[];
    },
  });

  const { data: legacyConvs = [] } = useQuery({
    queryKey: ["legacy-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*, parent_accounts(parent_name, father_phone)")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ---- Unread counts ----
  const { data: unreadMap = {} } = useQuery({
    queryKey: ["chat-unread-counts", user?.id],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const [{ data: unified }, { data: legacy }] = await Promise.all([
        supabase.from("unified_messages").select("conversation_id, sender_id, is_read").eq("is_read", false),
        supabase.from("chat_messages").select("conversation_id, sender_id, is_read, sender_type").eq("is_read", false),
      ]);
      (unified || []).forEach((m: any) => {
        if (m.sender_id === user?.id) return;
        counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
      });
      (legacy || []).forEach((m: any) => {
        if (m.sender_type === "employee") return;
        counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user?.id,
  });

  const totalUnread = Object.values(unreadMap).reduce((a: number, b: number) => a + b, 0);

  // Combine into one list
  const allConversations = [
    ...unifiedConvs.map((c) => ({
      id: c.id,
      name: c.subject?.replace("Chat with ", "") || "Chat",
      subtitle:
        c.type === "staff_dm" ? "Staff"
        : c.type === "customer_dm" ? "Customer"
        : c.type === "customer_support" ? "Customer Support"
        : c.type === "customer_supervisor" ? "Private • Parent ↔ Supervisor"
        : "Route Group",
      type: c.type as ChatCategory,
      lastMessageAt: c.last_message_at,
      unread: unreadMap[c.id] || 0,
      raw: c,
      isLegacy: false,
    })),

    ...legacyConvs.map((c: any) => ({
      id: c.id,
      name: c.parent_accounts?.parent_name || "Support",
      subtitle: `Support • ${c.status}`,
      type: "legacy" as ChatCategory,
      lastMessageAt: c.last_message_at,
      unread: unreadMap[c.id] || 0,
      raw: c,
      isLegacy: true,
    })),

  ].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  const filteredConversations = allConversations.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = category === "all" || c.type === category;
    return matchSearch && matchCategory;
  });

  const selectedConv = allConversations.find((c) => c.id === selectedConvId);

  // Messages for selected conversation
  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["chat-messages-view", selectedConvId, selectedConv?.isLegacy],
    queryFn: async () => {
      if (!selectedConvId) return [];
      if (selectedConv?.isLegacy) {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", selectedConvId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data.map((m: any) => ({
          id: m.id, message: m.message, sender_id: m.sender_id,
          sender_type: m.sender_type, sender_name: m.sender_type === "employee" ? "You" : "Parent",
          is_read: m.is_read, created_at: m.created_at,
        }));
      } else {
        const { data, error } = await supabase
          .from("unified_messages")
          .select("*")
          .eq("conversation_id", selectedConvId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data;
      }
    },
    enabled: !!selectedConvId,
  });

  // Realtime
  useEffect(() => {
    if (!selectedConvId) return;
    const table = selectedConv?.isLegacy ? "chat_messages" : "unified_messages";
    const channel = supabase
      .channel(`msgs-${selectedConvId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table,
        filter: `conversation_id=eq.${selectedConvId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages-view", selectedConvId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConvId, selectedConv?.isLegacy, queryClient]);

  // Mark the open conversation's incoming messages as read
  useEffect(() => {
    if (!selectedConvId || !user?.id) return;
    const isLegacy = selectedConv?.isLegacy;
    const markRead = async () => {
      if (isLegacy) {
        await supabase
          .from("chat_messages")
          .update({ is_read: true })
          .eq("conversation_id", selectedConvId)
          .eq("is_read", false)
          .neq("sender_type", "employee");
      } else {
        await supabase
          .from("unified_messages")
          .update({ is_read: true })
          .eq("conversation_id", selectedConvId)
          .eq("is_read", false)
          .neq("sender_id", user.id);
      }
      queryClient.invalidateQueries({ queryKey: ["chat-unread-counts"] });
    };
    markRead();
  }, [selectedConvId, selectedConv?.isLegacy, messages.length, user?.id, queryClient]);

  // Global new-message listener: unread badges + toast pop-up
  const selectedConvIdRef = useRef<string | null>(null);
  selectedConvIdRef.current = selectedConvId;

  useEffect(() => {
    if (!user?.id) return;
    const handleIncoming = (payload: any, isLegacy: boolean) => {
      const msg = payload.new;
      if (!msg) return;
      if (!isLegacy && msg.sender_id === user.id) return;
      if (isLegacy && msg.sender_type === "employee") return;
      queryClient.invalidateQueries({ queryKey: ["chat-unread-counts"] });
      queryClient.invalidateQueries({ queryKey: ["all-unified-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["legacy-conversations"] });
      if (msg.conversation_id === selectedConvIdRef.current) return;
      toast({
        title: `New message${msg.sender_name ? ` from ${msg.sender_name}` : ""}`,
        description: String(msg.message || "").slice(0, 120),
      });
    };

    const channel = supabase
      .channel("support-chat-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "unified_messages" }, (p) => handleIncoming(p, false))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => handleIncoming(p, true))
      .on("postgres_changes", { event: "*", schema: "public", table: "unified_conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-unified-conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConvId || !user?.id || !newMessage.trim()) return;
      if (selectedConv?.isLegacy) {
        await supabase.from("chat_messages").insert({
          conversation_id: selectedConvId, sender_type: "employee",
          sender_id: user.id, message: newMessage.trim(),
        });
        await supabase.from("chat_conversations")
          .update({ last_message_at: new Date().toISOString(), status: "pending" })
          .eq("id", selectedConvId);
      } else {
        await supabase.from("unified_messages").insert({
          conversation_id: selectedConvId, sender_id: user.id,
          sender_type: "employee",
          sender_name: user.user_metadata?.full_name || user.email || "Support",
          message: newMessage.trim(),
        });
        await supabase.from("unified_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", selectedConvId);
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages-view", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["all-unified-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["legacy-conversations"] });
    },
  });

  // ---- New chat helpers ----
  const { data: routes = [] } = useQuery({
    queryKey: ["routes-for-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("routes").select("id, name, school_id, driver_id, supervisor_id, schools(name)").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const startStaffChat = useMutation({
    mutationFn: async (staff: StaffTarget) => {
      if (!user?.id) throw new Error("Not authenticated");
      let staffUserId: string | null = staff.user_id || null;

      if (staff.type !== "employee") {
        const { data: accounts } = await supabase
          .from("driver_accounts").select("user_id")
          .eq(staff.type === "driver" ? "driver_id" : "supervisor_id", staff.id)
          .eq("is_active", true).maybeSingle();
        staffUserId = accounts?.user_id || null;
      }

      if (staffUserId) {
        const { data: existing } = await supabase
          .from("unified_conversations").select("id, conversation_participants!inner(*)")
          .eq("type", "staff_dm");
        if (existing) {
          for (const conv of existing) {
            const parts = (conv as any).conversation_participants || [];
            if (parts.some((p: any) => p.user_id === user.id) && parts.some((p: any) => p.user_id === staffUserId)) {
              return conv.id;
            }
          }
        }
      }

      const { data: conv } = await supabase.from("unified_conversations")
        .insert({ type: "staff_dm" as any, subject: `Chat with ${staff.full_name}`, created_by: user.id })
        .select().single();
      if (!conv) throw new Error("Failed");

      const participants: any[] = [{ conversation_id: conv.id, user_id: user.id, participant_type: "employee", participant_ref_id: employee?.id, can_send: true }];
      if (staffUserId) participants.push({ conversation_id: conv.id, user_id: staffUserId, participant_type: staff.type, participant_ref_id: staff.id, can_send: true });
      await supabase.from("conversation_participants").insert(participants);
      return conv.id;
    },
    onSuccess: (id) => {
      if (id) { setSelectedConvId(id); setShowNewStaffChat(false); }
      queryClient.invalidateQueries({ queryKey: ["all-unified-conversations"] });
    },
    onError: (e: any) => toast({ title: "Could not start chat", description: e.message, variant: "destructive" }),
  });


  const startCustomerChat = useMutation({
    mutationFn: async (customer: any) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (customer.user_id) {
        const { data: existing } = await supabase.from("unified_conversations").select("id, conversation_participants!inner(*)").eq("type", "customer_dm");
        if (existing) {
          for (const conv of existing) {
            const parts = (conv as any).conversation_participants || [];
            if (parts.some((p: any) => p.user_id === customer.user_id) && parts.some((p: any) => p.user_id === user.id)) return conv.id;
          }
        }
      }
      const { data: conv } = await supabase.from("unified_conversations")
        .insert({ type: "customer_dm" as any, subject: `Chat with ${customer.parent_name}`, created_by: user.id })
        .select().single();
      if (!conv) throw new Error("Failed");
      const participants: any[] = [{ conversation_id: conv.id, user_id: user.id, participant_type: "employee", participant_ref_id: employee?.id, can_send: true }];
      if (customer.user_id) participants.push({ conversation_id: conv.id, user_id: customer.user_id, participant_type: "parent", participant_ref_id: customer.id, can_send: true });
      await supabase.from("conversation_participants").insert(participants);
      return conv.id;
    },
    onSuccess: (id) => {
      if (id) { setSelectedConvId(id); setShowNewCustomerChat(false); }
      queryClient.invalidateQueries({ queryKey: ["all-unified-conversations"] });
    },
  });

  const [selectedRouteId, setSelectedRouteId] = useState("");
  const existingRouteIds = new Set(unifiedConvs.filter((c) => c.type === "route_group").map((c) => c.route_id));
  const availableRoutes = routes.filter((r) => !existingRouteIds.has(r.id));

  const createGroupChat = useMutation({
    mutationFn: async (routeId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const route = routes.find((r) => r.id === routeId);
      if (!route) throw new Error("Route not found");
      const { data: conv } = await supabase.from("unified_conversations")
        .insert({ type: "route_group" as any, route_id: routeId, subject: `${route.name} - Group Chat`, allow_customer_messages: false, created_by: user.id })
        .select().single();
      if (!conv) throw new Error("Failed");

      const participants: any[] = [{ conversation_id: conv.id, user_id: user.id, participant_type: "employee", participant_ref_id: employee?.id, can_send: true }];
      if ((route as any).supervisor_id) {
        const { data: supAccount } = await supabase.from("driver_accounts").select("user_id").eq("supervisor_id", (route as any).supervisor_id).eq("is_active", true).maybeSingle();
        if (supAccount?.user_id) participants.push({ conversation_id: conv.id, user_id: supAccount.user_id, participant_type: "supervisor", participant_ref_id: (route as any).supervisor_id, can_send: true });
      }
      const { data: assignments } = await supabase.from("route_assignments").select("registration_id, registrations(parent_id, parent_accounts(id, user_id))").eq("route_id", routeId);
      if (assignments) {
        const addedIds = new Set(participants.map((p) => p.user_id));
        for (const a of assignments) {
          const parent = (a as any).registrations?.parent_accounts;
          if (parent?.user_id && !addedIds.has(parent.user_id)) {
            participants.push({ conversation_id: conv.id, user_id: parent.user_id, participant_type: "parent", participant_ref_id: parent.id, can_send: false });
            addedIds.add(parent.user_id);
          }
        }
      }
      await supabase.from("conversation_participants").insert(participants);
      return conv.id;
    },
    onSuccess: (id) => {
      if (id) { setSelectedConvId(id); setShowNewGroupChat(false); setSelectedRouteId(""); }
      queryClient.invalidateQueries({ queryKey: ["all-unified-conversations"] });
    },
  });

  // Toggle customer messages for route groups
  const toggleCustomerMessages = useMutation({
    mutationFn: async ({ conversationId, allow }: { conversationId: string; allow: boolean }) => {
      await supabase.from("unified_conversations").update({ allow_customer_messages: allow }).eq("id", conversationId);
      await supabase.from("conversation_participants").update({ can_send: allow }).eq("conversation_id", conversationId).eq("participant_type", "parent");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-unified-conversations"] }),
  });

  const getIcon = (type: string) => {
    if (type === "staff_dm") return <UserCircle className="h-5 w-5 text-primary" />;
    if (type === "customer_dm") return <User className="h-5 w-5 text-blue-600" />;
    if (type === "route_group") return <Bus className="h-5 w-5 text-green-600" />;
    return <Headphones className="h-5 w-5 text-orange-500" />;
  };

  const getIconBg = (type: string) => {
    if (type === "staff_dm") return "bg-primary/10";
    if (type === "customer_dm") return "bg-blue-100 dark:bg-blue-900/30";
    if (type === "route_group") return "bg-green-100 dark:bg-green-900/30";
    return "bg-orange-100 dark:bg-orange-900/30";
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return format(date, "hh:mm a");
    if (diffDays === 1) return "Yesterday";
    return format(date, "dd/MM");
  };

  // ---- Render sidebar ----
  const renderSidebar = () => (
    <div className={`flex flex-col bg-card rounded-2xl border border-border/50 shadow-lg overflow-hidden ${isMobile ? "w-full h-full" : "w-[340px] shrink-0"}`}>
      <div className="p-3 border-b border-border/30 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-muted/40 border-0 rounded-xl text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {[
            { value: "all", label: "All" },
            { value: "staff_dm", label: "Staff" },
            { value: "customer_dm", label: "Customers" },
            { value: "customer_support", label: "Support Chats" },
            { value: "customer_supervisor", label: "Supervisor (Private)" },
            { value: "route_group", label: "Groups" },
            { value: "legacy", label: "Support" },
          ].map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value as ChatCategory)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* New chat buttons */}
      <div className="px-3 py-2 flex gap-1.5 border-b border-border/20">
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1 rounded-lg flex-1" onClick={() => setShowNewStaffChat(true)}>
          <Plus className="h-3 w-3" /> Staff
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1 rounded-lg flex-1" onClick={() => setShowNewCustomerChat(true)}>
          <Plus className="h-3 w-3" /> Customer
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1 rounded-lg flex-1" onClick={() => setShowNewGroupChat(true)} disabled={availableRoutes.length === 0}>
          <Plus className="h-3 w-3" /> Group
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loadingUnified ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : filteredConversations.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm">No conversations</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filteredConversations.map((conv) => {
              const isActive = selectedConvId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                    isActive ? "bg-primary/5 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getIconBg(conv.type)}`}>
                    {getIcon(conv.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>{conv.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(conv.lastMessageAt)}</span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // ---- Render message area ----
  const renderMessageArea = () => {
    if (!selectedConvId || !selectedConv) {
      return (
        <div className="flex-1 bg-card rounded-2xl border border-border/50 shadow-lg flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-base font-medium mb-1">Select a conversation</p>
            <p className="text-sm">Choose a conversation from the list to start messaging</p>
          </div>
        </div>
      );
    }

    const rawConv = selectedConv.raw;
    const isRouteGroup = selectedConv.type === "route_group";

    return (
      <div className="flex-1 bg-card rounded-2xl border border-border/50 shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/30">
          {isMobile && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedConvId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getIconBg(selectedConv.type)}`}>
            {getIcon(selectedConv.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{selectedConv.name}</p>
            <p className="text-xs text-green-500 font-medium">Online</p>
          </div>
          {isRouteGroup && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Customer Messages</span>
              <Switch
                checked={rawConv?.allow_customer_messages || false}
                onCheckedChange={(checked) =>
                  toggleCustomerMessages.mutate({ conversationId: selectedConvId!, allow: checked })
                }
              />
            </div>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-3">
            {loadingMsgs ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : messages.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">Start the conversation...</p>
            ) : (
              messages.map((msg: any) => {
                const isMine = msg.sender_id === user?.id || (msg.sender_type === "employee" && selectedConv.isLegacy);
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"
                    }`}>
                      {!isMine && msg.sender_name && (
                        <p className="text-[10px] font-semibold mb-0.5 text-muted-foreground">{msg.sender_name}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      <div className={`flex items-center gap-1 text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`} dir="ltr">
                        <span>{format(new Date(msg.created_at), "hh:mm a")}</span>
                        {isMine && msg.is_read && <CheckCircle className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={(e) => { e.preventDefault(); sendMutation.mutate(); }} className="px-5 py-3 border-t border-border/30 flex items-center gap-3">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
            disabled={sendMutation.isPending}
          />
          <Button type="submit" size="default" disabled={sendMutation.isPending || !newMessage.trim()} className="h-11 px-5 rounded-xl gap-1.5">
            Send
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <div className="mb-4">
          <PageHero
            icon={MessageCircle}
            title="Support & Communications"
            description="Manage all chat channels in one place"
          />
        </div>

        <div className="flex gap-4 h-[calc(100%-5rem)]">
          {isMobile ? (
            selectedConvId ? renderMessageArea() : renderSidebar()
          ) : (
            <>
              {renderSidebar()}
              {renderMessageArea()}
            </>
          )}
        </div>
      </div>

      {/* New Staff Chat Dialog */}
      <StaffPickerDialog
        open={showNewStaffChat}
        onOpenChange={setShowNewStaffChat}
        onSelect={(s) => startStaffChat.mutate(s)}
        isPending={startStaffChat.isPending}
      />

      {/* New Customer Chat Dialog */}
      <CustomerPickerDialog
        open={showNewCustomerChat}
        onOpenChange={setShowNewCustomerChat}
        onSelect={(c) => startCustomerChat.mutate(c)}
        isPending={startCustomerChat.isPending}
      />


      {/* New Group Chat Dialog */}
      <Dialog open={showNewGroupChat} onOpenChange={setShowNewGroupChat}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Route Group Chat</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
              <SelectTrigger><SelectValue placeholder="Choose a route..." /></SelectTrigger>
              <SelectContent>
                {availableRoutes.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.name} — {r.schools?.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">Creates a group with all customers on this route. Customers receive only by default.</p>
            <Button className="w-full" onClick={() => createGroupChat.mutate(selectedRouteId)}
              disabled={!selectedRouteId || createGroupChat.isPending}>
              {createGroupChat.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Group Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
