import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, Send, Loader2, Plus, ArrowLeft, 
  Phone as PhoneIcon, User, ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const WHATSAPP_NUMBER = "201000000000"; // Replace with actual company WhatsApp

export function ParentChat() {
  const { parentAccount, user } = useParentAuth();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations where this parent is a participant
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["parent-unified-conversations", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get conversation IDs where parent is participant
      const { data: participantData } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!participantData || participantData.length === 0) return [];

      const conversationIds = participantData.map((p) => p.conversation_id);
      const { data: convos } = await supabase
        .from("unified_conversations")
        .select("*")
        .in("id", conversationIds)
        .order("last_message_at", { ascending: false });

      // Enrich with last message and unread count
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
          };
        })
      );

      return enriched;
    },
    enabled: !!user?.id,
  });

  // Also fetch legacy conversations from chat_conversations
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
      return (data || []).map((c) => ({ ...c, isLegacy: true }));
    },
    enabled: !!parentAccount?.id,
  });

  // Fetch messages for selected conversation
  const selectedConvo = conversations.find((c) => c.id === selectedConversationId);
  const isLegacySelected = !selectedConvo && legacyConversations.find((c: any) => c.id === selectedConversationId);

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["parent-chat-messages", selectedConversationId, !!isLegacySelected],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      
      if (isLegacySelected) {
        const { data } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", selectedConversationId)
          .order("created_at", { ascending: true });
        return (data || []).map((m) => ({ ...m, sender_name: m.sender_type === "parent" ? parentAccount?.parent_name : "الدعم", isLegacy: true }));
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

  // Real-time subscription
  useEffect(() => {
    if (!selectedConversationId) return;
    
    const table = isLegacySelected ? "chat_messages" : "unified_messages";
    const channel = supabase
      .channel(`parent-chat-${selectedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["parent-chat-messages", selectedConversationId] });
          queryClient.invalidateQueries({ queryKey: ["parent-unified-conversations"] });
          queryClient.invalidateQueries({ queryKey: ["parent-legacy-conversations"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversationId, isLegacySelected, queryClient]);

  // Mark messages as read
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

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message (unified)
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim() || !selectedConversationId || !user?.id) return;

      if (isLegacySelected) {
        await supabase.from("chat_messages").insert({
          conversation_id: selectedConversationId,
          sender_type: "parent",
          sender_id: user.id,
          message: newMessage.trim(),
        });
        await supabase
          .from("chat_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", selectedConversationId);
      } else {
        await supabase.from("unified_messages").insert({
          conversation_id: selectedConversationId,
          sender_id: user.id,
          sender_type: "parent",
          sender_name: parentAccount?.parent_name || "ولي الأمر",
          message: newMessage.trim(),
        });
        await supabase
          .from("unified_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", selectedConversationId);
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["parent-chat-messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["parent-unified-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["parent-legacy-conversations"] });
    },
  });

  // Create new conversation (customer_supervisor type)
  const createConversation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user");
      
      const { data: convo, error } = await supabase
        .from("unified_conversations")
        .insert({
          type: "customer_supervisor" as any,
          subject: newSubject || "محادثة جديدة",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Add parent as participant
      await supabase.from("conversation_participants").insert({
        conversation_id: convo.id,
        user_id: user.id,
        participant_type: "parent",
        participant_ref_id: parentAccount?.id,
        can_send: true,
      });

      return convo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["parent-unified-conversations"] });
      setSelectedConversationId(data.id);
      setIsCreating(false);
      setNewSubject("");
    },
  });

  const openWhatsApp = () => {
    const message = encodeURIComponent(`مرحباً، أنا ${parentAccount?.parent_name} - أريد الاستفسار عن خدمة النقل المدرسي`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
  };

  // All conversations combined
  const allConversations = [
    ...conversations.map((c) => ({ ...c, isLegacy: false })),
    ...legacyConversations,
  ];

  // Conversation list view
  if (!selectedConversationId && !isCreating) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              المحادثات
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openWhatsApp} className="gap-1">
                <PhoneIcon className="h-4 w-4" />
                واتساب
              </Button>
              <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                جديدة
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : allConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">لا توجد محادثات</p>
              <p className="text-sm">ابدأ محادثة جديدة أو تواصل عبر واتساب</p>
            </div>
          ) : (
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {allConversations.map((conv: any) => (
                <button
                  key={conv.id}
                  className="w-full p-4 text-right hover:bg-muted/50 transition-colors flex items-center gap-3"
                  onClick={() => setSelectedConversationId(conv.id)}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-primary text-primary-foreground text-xs h-5 min-w-5 flex items-center justify-center">
                            {conv.unreadCount}
                          </Badge>
                        )}
                        {conv.isLegacy && (
                          <Badge variant="outline" className="text-[10px]">قديم</Badge>
                        )}
                      </div>
                      <span className="font-medium text-sm truncate">{conv.subject || "محادثة"}</span>
                    </div>
                    {conv.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate text-right">
                        {conv.lastMessage.sender_name}: {conv.lastMessage.message}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 text-right mt-0.5">
                      {format(new Date(conv.last_message_at || conv.created_at), "dd MMM hh:mm a", { locale: ar })}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 rtl:rotate-180" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Create new conversation view
  if (isCreating) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>محادثة جديدة</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">موضوع المحادثة</label>
            <Input
              placeholder="مثال: استفسار عن الرسوم"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              dir="rtl"
            />
          </div>
          <Button 
            className="w-full"
            onClick={() => createConversation.mutate()}
            disabled={createConversation.isPending}
          >
            {createConversation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            بدء المحادثة
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Chat view
  const currentConvo = allConversations.find((c: any) => c.id === selectedConversationId);

  return (
    <Card className="border-0 shadow-md flex flex-col h-[500px]">
      <CardHeader className="border-b py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedConversationId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-base truncate">
            {currentConvo?.subject || "محادثة"}
          </CardTitle>
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>ابدأ المحادثة بإرسال رسالة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg: any) => {
              const isMe = msg.sender_id === user?.id || msg.sender_type === "parent";
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}
                  >
                    {!isMe && msg.sender_name && (
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">
                        {msg.sender_name}
                      </p>
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

      <div className="p-3 border-t shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage.mutate();
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="اكتب رسالتك..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sendMessage.isPending}
            dir="rtl"
            className="rounded-xl"
          />
          <Button type="submit" size="icon" className="rounded-xl shrink-0" disabled={sendMessage.isPending || !newMessage.trim()}>
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
