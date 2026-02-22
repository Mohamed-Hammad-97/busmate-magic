import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/contexts/DriverAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, ArrowRight, User } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export function DriverChatSection() {
  const { user, driverAccount, isDriver } = useDriverAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const senderName = isDriver
    ? driverAccount?.driver?.full_name
    : driverAccount?.supervisor?.full_name;

  // Fetch conversations where this driver/supervisor is a participant
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["driver-conversations", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
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

      // For each conversation, get other participants' names
      const enriched = await Promise.all(
        (convos || []).map(async (convo) => {
          const { data: participants } = await supabase
            .from("conversation_participants")
            .select("*")
            .eq("conversation_id", convo.id)
            .neq("user_id", user.id);

          // Get last message
          const { data: lastMsg } = await supabase
            .from("unified_messages")
            .select("message, created_at, sender_name")
            .eq("conversation_id", convo.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count } = await supabase
            .from("unified_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", convo.id)
            .eq("is_read", false)
            .neq("sender_id", user.id);

          return {
            ...convo,
            otherParticipants: participants || [],
            lastMessage: lastMsg,
            unreadCount: count || 0,
          };
        })
      );

      return enriched;
    },
    enabled: !!user?.id,
  });

  // Fetch messages for selected conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["driver-chat-messages", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
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
    const channel = supabase
      .channel(`driver-chat-${selectedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "unified_messages",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["driver-chat-messages", selectedConversationId] });
          queryClient.invalidateQueries({ queryKey: ["driver-conversations"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversationId, queryClient]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedConversationId || !user?.id) return;
    supabase
      .from("unified_messages")
      .update({ is_read: true })
      .eq("conversation_id", selectedConversationId)
      .neq("sender_id", user.id)
      .eq("is_read", false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["driver-conversations"] });
      });
  }, [selectedConversationId, messages, user?.id, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim() || !selectedConversationId || !user?.id) return;
      await supabase.from("unified_messages").insert({
        conversation_id: selectedConversationId,
        sender_id: user.id,
        sender_type: isDriver ? "driver" : "supervisor",
        sender_name: senderName || "Driver",
        message: newMessage.trim(),
      });
      await supabase
        .from("unified_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", selectedConversationId);
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["driver-chat-messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["driver-conversations"] });
    },
  });

  // Conversation list view
  if (!selectedConversationId) {
    return (
      <div className="space-y-3">
        {loadingConversations ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">لا توجد محادثات</p>
              <p className="text-sm mt-1">سيتم إنشاء محادثات من قبل الإدارة</p>
            </CardContent>
          </Card>
        ) : (
          conversations.map((convo) => (
            <Card
              key={convo.id}
              className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedConversationId(convo.id)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">
                        {convo.subject || "محادثة"}
                      </p>
                      {convo.unreadCount > 0 && (
                        <Badge className="bg-primary text-primary-foreground text-xs h-5 min-w-5 flex items-center justify-center">
                          {convo.unreadCount}
                        </Badge>
                      )}
                    </div>
                    {convo.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {convo.lastMessage.sender_name}: {convo.lastMessage.message}
                      </p>
                    )}
                    {convo.lastMessage?.created_at && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {format(new Date(convo.lastMessage.created_at), "dd MMM hh:mm a", { locale: ar })}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0 rtl:rotate-180" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Chat view
  const currentConvo = conversations.find((c) => c.id === selectedConversationId);

  return (
    <div className="flex flex-col h-[60vh]">
      {/* Chat header */}
      <div className="flex items-center gap-3 pb-3 border-b mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedConversationId(null)}
          className="shrink-0"
        >
          ← رجوع
        </Button>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{currentConvo?.subject || "محادثة"}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-1">
        <div className="space-y-3 py-2">
          {messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  {!isMe && (
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
      </ScrollArea>

      {/* Input */}
      <div className="flex items-center gap-2 pt-3 border-t mt-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage.mutate()}
          placeholder="اكتب رسالتك..."
          className="flex-1 rounded-xl"
          dir="rtl"
        />
        <Button
          size="icon"
          className="rounded-xl h-10 w-10 shrink-0"
          onClick={() => sendMessage.mutate()}
          disabled={!newMessage.trim() || sendMessage.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
