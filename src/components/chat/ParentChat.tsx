import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle, Send, Loader2, Plus, ArrowLeft, Lock,
  Search, Headphones, Bus, UserCog,
} from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface SupervisorTarget {
  supervisor_id: string;
  supervisor_name: string;
  route_id: string;
  route_name: string;
  route_number: number | null;
  student_name: string | null;
}

export function ParentChat() {
  const { parentAccount, user } = useParentAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startingTarget, setStartingTarget] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const callStartFn = async (payload: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("parent-start-conversation", {
      body: payload,
      headers: sessionData?.session?.access_token
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : undefined,
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  // Conversations where this parent is a participant
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["parent-unified-conversations", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: participantData } = await supabase
        .from("conversation_participants")
        .select("conversation_id, can_send")
        .eq("user_id", user.id);
      if (!participantData || participantData.length === 0) return [];
      const canSendMap = new Map(participantData.map((p) => [p.conversation_id, p.can_send !== false]));
      const conversationIds = participantData.map((p) => p.conversation_id);
      const { data: convos } = await supabase
        .from("unified_conversations")
        .select("*")
        .in("id", conversationIds)
        .order("last_message_at", { ascending: false });
      const enriched = await Promise.all(
        (convos || []).map(async (convo) => {
          const { data: lastMsg } = await supabase
            .from("unified_messages")
            .select("message, created_at, sender_name")
            .eq("conversation_id", convo.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const { count } = await supabase
            .from("unified_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", convo.id)
            .eq("is_read", false)
            .neq("sender_id", user.id);
          return {
            ...convo,
            lastMessage: lastMsg,
            unreadCount: count || 0,
            canSend: convo.type === "route_group"
              ? (canSendMap.get(convo.id) ?? false) && convo.allow_customer_messages !== false
              : canSendMap.get(convo.id) ?? true,
          };
        })
      );
      return enriched;
    },
    enabled: !!user?.id,
  });

  const { data: legacyConversations = [] } = useQuery({
    queryKey: ["parent-legacy-conversations", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("parent_id", parentAccount.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((c) => ({ ...c, isLegacy: true, canSend: true }));
    },
    enabled: !!parentAccount?.id,
  });

  // Supervisors available to this parent (for the new-chat picker)
  const { data: supervisorTargets = [], isLoading: loadingTargets } = useQuery({
    queryKey: ["parent-chat-targets", user?.id],
    queryFn: async () => {
      const res = await callStartFn({ target: "targets" });
      return (res?.supervisors ?? []) as SupervisorTarget[];
    },
    enabled: !!user?.id && isCreating,
  });

  const selectedConvo = conversations.find((c) => c.id === selectedConversationId);
  const isLegacySelected = !selectedConvo && !!legacyConversations.find((c: any) => c.id === selectedConversationId);

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["parent-chat-messages", selectedConversationId, isLegacySelected],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      if (isLegacySelected) {
        const { data } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", selectedConversationId)
          .order("created_at", { ascending: true });
        return (data || []).map((m) => ({
          ...m,
          sender_name: m.sender_type === "parent" ? parentAccount?.parent_name : "خدمة العملاء",
          isLegacy: true,
        }));
      }
      const { data } = await supabase
        .from("unified_messages")
        .select("*")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedConversationId,
  });

  useEffect(() => {
    if (!selectedConversationId) return;
    const table = isLegacySelected ? "chat_messages" : "unified_messages";
    const channel = supabase
      .channel(`parent-chat-${selectedConversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table, filter: `conversation_id=eq.${selectedConversationId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["parent-chat-messages", selectedConversationId] });
        queryClient.invalidateQueries({ queryKey: ["parent-unified-conversations"] });
        queryClient.invalidateQueries({ queryKey: ["parent-legacy-conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversationId, isLegacySelected, queryClient]);

  useEffect(() => {
    if (!selectedConversationId || !user?.id) return;
    const table = isLegacySelected ? "chat_messages" : "unified_messages";
    supabase
      .from(table)
      .update({ is_read: true })
      .eq("conversation_id", selectedConversationId)
      .neq("sender_id", user.id)
      .eq("is_read", false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["parent-unified-conversations"] });
      });
  }, [selectedConversationId, messages, user?.id, isLegacySelected, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim() || !selectedConversationId || !user?.id) return;
      if (isLegacySelected) {
        await supabase.from("chat_messages").insert({
          conversation_id: selectedConversationId, sender_type: "parent", sender_id: user.id, message: newMessage.trim(),
        });
        await supabase.from("chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", selectedConversationId);
      } else {
        const { error } = await supabase.from("unified_messages").insert({
          conversation_id: selectedConversationId, sender_id: user.id, sender_type: "parent",
          sender_name: parentAccount?.parent_name || "ولي الأمر", message: newMessage.trim(),
        });
        if (error) throw error;
        await supabase.from("unified_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", selectedConversationId);
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["parent-chat-messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["parent-unified-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["parent-legacy-conversations"] });
    },
    onError: () => {
      toast({ title: "تعذر إرسال الرسالة", variant: "destructive" });
    },
  });

  const startConversation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => callStartFn(payload),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["parent-unified-conversations"] });
      setSelectedConversationId(res.conversation_id);
      setIsCreating(false);
      setStartingTarget(null);
    },
    onError: (e: any) => {
      setStartingTarget(null);
      toast({ title: "تعذر بدء المحادثة", description: e?.message, variant: "destructive" });
    },
  });

  const allConversations: any[] = [
    ...conversations.map((c) => ({ ...c, isLegacy: false })),
    ...legacyConversations,
  ];

  const convoTitle = (conv: any) => {
    if (conv.isLegacy) return "خدمة العملاء";
    if (conv.type === "route_group") return conv.subject || "جروب الخط";
    if (conv.type === "customer_support" || conv.type === "customer_dm") return "خدمة العملاء";
    if (conv.type === "customer_supervisor") return conv.subject || "المشرف";
    return conv.subject || "محادثة";
  };

  const convoSubtitle = (conv: any) => {
    if (conv.type === "route_group") return "جروب الخط";
    if (conv.type === "customer_supervisor") return "محادثة خاصة مع المشرف";
    return "الدعم والمساعدة";
  };

  const filteredConversations = allConversations.filter((c: any) =>
    !searchTerm || convoTitle(c).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getConvoIcon = (conv: any) => {
    if (conv?.type === "route_group") return <Bus className="h-5 w-5 text-primary" />;
    if (conv?.type === "customer_supervisor") return <UserCog className="h-5 w-5 text-primary" />;
    return <Headphones className="h-5 w-5 text-primary" />;
  };

  const currentConvo = allConversations.find((c: any) => c.id === selectedConversationId);
  const canSendInCurrent = currentConvo ? currentConvo.canSend !== false : false;

  const groupConversations = conversations.filter((c: any) => c.type === "route_group");

  // --- Sidebar ---
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المحادثات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl bg-muted/50 border-0 h-9 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-4 text-center">
            <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">لا توجد محادثات</p>
            <p className="text-xs mt-1">ابدأ محادثة جديدة من الزر بالأسفل</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conv: any) => (
              <button
                key={conv.id}
                className={`w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 ${
                  selectedConversationId === conv.id ? "bg-muted" : ""
                }`}
                onClick={() => { setSelectedConversationId(conv.id); setIsCreating(false); }}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {getConvoIcon(conv)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-sm truncate">{convoTitle(conv)}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {format(new Date(conv.last_message_at || conv.created_at), "hh:mm a")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage?.message || convoSubtitle(conv)}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center shrink-0">
                    {conv.unreadCount}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t">
        <Button size="sm" className="w-full gap-2" onClick={() => { setIsCreating(true); setSelectedConversationId(null); }}>
          <Plus className="h-4 w-4" /> محادثة جديدة
        </Button>
      </div>
    </div>
  );

  // --- New chat picker ---
  const newChatPicker = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setIsCreating(false)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h3 className="font-semibold text-sm">محادثة جديدة</h3>
          <p className="text-xs text-muted-foreground">اختر الجهة التي تريد مراسلتها</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3 max-w-md mx-auto">
          {/* Customer service */}
          <button
            className="w-full flex items-center gap-3 p-4 rounded-2xl border hover:bg-muted/50 transition-colors text-left"
            disabled={startConversation.isPending}
            onClick={() => { setStartingTarget("support"); startConversation.mutate({ target: "support" }); }}
          >
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">خدمة العملاء</p>
              <p className="text-xs text-muted-foreground">استفسارات الاشتراك والمدفوعات والدعم</p>
            </div>
            {startingTarget === "support" && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>

          {/* Supervisors */}
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">مشرف الخط (محادثة خاصة)</p>
            {loadingTargets ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : supervisorTargets.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">لا يوجد مشرف مرتبط بحسابك حالياً</p>
            ) : (
              <div className="space-y-2">
                {supervisorTargets.map((t) => (
                  <button
                    key={t.supervisor_id}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border hover:bg-muted/50 transition-colors text-left"
                    disabled={startConversation.isPending}
                    onClick={() => {
                      setStartingTarget(t.supervisor_id);
                      startConversation.mutate({ target: "supervisor", supervisor_id: t.supervisor_id });
                    }}
                  >
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCog className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.supervisor_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.student_name ? `${t.student_name} • ` : ""}
                        {t.route_number ? `خط رقم ${t.route_number}` : t.route_name}
                      </p>
                    </div>
                    {startingTarget === t.supervisor_id && <Loader2 className="h-4 w-4 animate-spin" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line groups */}
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">جروب الخط</p>
            {groupConversations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">لم تتم إضافتك إلى جروب خط بعد</p>
            ) : (
              <div className="space-y-2">
                {groupConversations.map((g: any) => (
                  <button
                    key={g.id}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border hover:bg-muted/50 transition-colors text-left"
                    onClick={() => { setSelectedConversationId(g.id); setIsCreating(false); }}
                  >
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{g.subject || "جروب الخط"}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.canSend ? "يمكنك المشاركة في الجروب" : "للقراءة فقط"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );

  const messageAreaContent = () => {
    if (isCreating) return newChatPicker();

    if (!selectedConversationId) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center px-6">
          <MessageCircle className="h-16 w-16 mb-3 opacity-20" />
          <p className="font-medium">اختر محادثة</p>
          <p className="text-sm">اختر محادثة من القائمة أو ابدأ محادثة جديدة</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSelectedConversationId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {getConvoIcon(currentConvo)}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{currentConvo ? convoTitle(currentConvo) : "محادثة"}</h3>
            <p className="text-xs text-muted-foreground truncate">{currentConvo ? convoSubtitle(currentConvo) : ""}</p>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">ابدأ المحادثة بإرسال رسالة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: any) => {
                const isMe = msg.sender_id === user?.id || (msg.isLegacy && msg.sender_type === "parent");
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"
                    }`}>
                      {!isMe && msg.sender_name && (
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">{msg.sender_name}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
                        {format(new Date(msg.created_at), "hh:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t">
          {canSendInCurrent ? (
            <form onSubmit={(e) => { e.preventDefault(); sendMessage.mutate(); }} className="flex gap-2">
              <Input
                placeholder="اكتب رسالة..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sendMessage.isPending}
                className="rounded-xl flex-1"
              />
              <Button type="submit" size="sm" className="rounded-xl px-5 shrink-0" disabled={sendMessage.isPending || !newMessage.trim()}>
                {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
              <Lock className="h-3.5 w-3.5" />
              هذا الجروب للقراءة فقط حالياً
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="border rounded-2xl shadow-md bg-background overflow-hidden h-[500px]">
        {selectedConversationId || isCreating ? messageAreaContent() : sidebarContent}
      </div>
    );
  }

  return (
    <div className="border rounded-2xl shadow-md bg-background overflow-hidden flex h-[500px]">
      <div className="w-80 border-r shrink-0 flex flex-col">
        {sidebarContent}
      </div>
      <div className="flex-1 flex flex-col">
        {messageAreaContent()}
      </div>
    </div>
  );
}
