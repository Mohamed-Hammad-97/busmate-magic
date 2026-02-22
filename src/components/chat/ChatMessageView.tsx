import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface ChatMessageViewProps {
  conversationId: string;
  senderType: string;
  onBack: () => void;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  headerActions?: React.ReactNode;
}

interface UnifiedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: string;
  sender_name: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function ChatMessageView({
  conversationId,
  senderType,
  onBack,
  title,
  subtitle,
  disabled = false,
  headerActions,
}: ChatMessageViewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["unified-messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as UnifiedMessage[];
    },
    enabled: !!conversationId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`unified-msgs-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "unified_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unified-messages", conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newMessage.trim()) return;
      const { error } = await supabase.from("unified_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_type: senderType,
        sender_name: user.user_metadata?.full_name || user.email || "Unknown",
        message: newMessage.trim(),
      });
      if (error) throw error;

      await supabase
        .from("unified_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["unified-messages", conversationId] });
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-semibold text-sm">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {headerActions}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {!isMe && (
                      <p className={`text-xs font-medium mb-1 ${isMe ? "text-primary-foreground/80" : "text-foreground/70"}`}>
                        {msg.sender_name || msg.sender_type}
                      </p>
                    )}
                    <p className="text-sm">{msg.message}</p>
                    <div className={`flex items-center gap-1 text-xs mt-1 ${
                      isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}>
                      <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                      {isMe && msg.is_read && <CheckCircle className="h-3 w-3" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage.mutate(); }}
          className="flex gap-2"
        >
          <Input
            placeholder={disabled ? "You cannot send messages here" : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sendMessage.isPending || disabled}
          />
          <Button type="submit" size="icon" disabled={sendMessage.isPending || !newMessage.trim() || disabled}>
            {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
