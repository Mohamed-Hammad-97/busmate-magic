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
  Phone as PhoneIcon, ExternalLink 
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Message {
  id: string;
  message: string;
  sender_type: string;
  sender_id: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  subject: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
}

const WHATSAPP_NUMBER = "201000000000"; // Replace with actual company WhatsApp

export function ParentChat() {
  const { parentAccount, user } = useParentAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["parent-conversations", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("parent_id", parentAccount.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!parentAccount?.id,
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["conversation-messages", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  // Subscribe to realtime messages
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages-${selectedConversation}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selectedConversation}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversation-messages", selectedConversation] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, queryClient]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create conversation
  const createConversation = useMutation({
    mutationFn: async () => {
      if (!parentAccount?.id) throw new Error("No parent account");
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          parent_id: parentAccount.id,
          subject: newSubject || "محادثة جديدة",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["parent-conversations"] });
      setSelectedConversation(data.id);
      setIsCreating(false);
      setNewSubject("");
    },
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedConversation || !user?.id || !newMessage.trim()) return;
      
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: selectedConversation,
        sender_type: "parent",
        sender_id: user.id,
        message: newMessage.trim(),
      });
      if (error) throw error;

      // Update last_message_at
      await supabase
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", selectedConversation);
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["parent-conversations"] });
    },
  });

  const openWhatsApp = () => {
    const message = encodeURIComponent(`مرحباً، أنا ${parentAccount?.parent_name} - أريد الاستفسار عن خدمة النقل المدرسي`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
  };

  // Conversation list view
  if (!selectedConversation && !isCreating) {
    return (
      <Card className="h-[500px] flex flex-col">
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
                محادثة جديدة
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          {loadingConversations ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
              <p>لا توجد محادثات</p>
              <p className="text-sm">ابدأ محادثة جديدة أو تواصل عبر واتساب</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="divide-y">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    className="w-full p-4 text-right hover:bg-muted transition-colors"
                    onClick={() => setSelectedConversation(conv.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={conv.status === "open" ? "default" : "secondary"}>
                        {conv.status === "open" ? "مفتوح" : conv.status === "pending" ? "في الانتظار" : "مغلق"}
                      </Badge>
                      <span className="font-medium">{conv.subject || "بدون عنوان"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(conv.last_message_at), "dd MMM yyyy HH:mm", { locale: ar })}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    );
  }

  // Create new conversation view
  if (isCreating) {
    return (
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>محادثة جديدة</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center gap-4 p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">موضوع المحادثة</label>
            <Input
              placeholder="مثال: استفسار عن الرسوم"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
            />
          </div>
          <Button 
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
  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="border-b py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-base">
            {conversations.find((c) => c.id === selectedConversation)?.subject || "محادثة"}
          </CardTitle>
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>ابدأ المحادثة بإرسال رسالة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_type === "parent" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.sender_type === "parent"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-xs mt-1 ${
                    msg.sender_type === "parent" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}>
                    {format(new Date(msg.created_at), "HH:mm", { locale: ar })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
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
          />
          <Button type="submit" size="icon" disabled={sendMessage.isPending || !newMessage.trim()}>
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
