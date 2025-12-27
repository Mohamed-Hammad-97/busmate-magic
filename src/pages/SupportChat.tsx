import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageCircle, Send, Loader2, User, Clock, 
  CheckCircle, Search, ArrowLeft, Phone
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
  parent_accounts: {
    parent_name: string;
    father_phone: string;
  };
  assigned_to: string | null;
}

export default function SupportChat() {
  const { user, employee } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["support-conversations", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("chat_conversations")
        .select(`
          *,
          parent_accounts (parent_name, father_phone)
        `)
        .order("last_message_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Conversation[];
    },
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["support-messages", selectedConversation],
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
      .channel(`support-messages-${selectedConversation}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selectedConversation}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support-messages", selectedConversation] });
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

  // Mark messages as read
  useEffect(() => {
    if (!selectedConversation || !messages.length) return;

    const unreadMessages = messages.filter(
      (m) => !m.is_read && m.sender_type === "parent"
    );

    if (unreadMessages.length > 0) {
      supabase
        .from("chat_messages")
        .update({ is_read: true })
        .in("id", unreadMessages.map((m) => m.id))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["support-messages", selectedConversation] });
        });
    }
  }, [selectedConversation, messages, queryClient]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedConversation || !user?.id || !newMessage.trim()) return;
      
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: selectedConversation,
        sender_type: "employee",
        sender_id: user.id,
        message: newMessage.trim(),
      });
      if (error) throw error;

      // Update conversation
      await supabase
        .from("chat_conversations")
        .update({ 
          last_message_at: new Date().toISOString(),
          status: "pending", // Set to pending after employee response
        })
        .eq("id", selectedConversation);
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["support-conversations"] });
    },
  });

  // Update conversation status
  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!selectedConversation) return;
      const { error } = await supabase
        .from("chat_conversations")
        .update({ status })
        .eq("id", selectedConversation);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-conversations"] });
    },
  });

  const filteredConversations = conversations.filter((conv) =>
    conv.parent_accounts?.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  const getUnreadCount = (convId: string) => {
    // For now, just check if the last message was from parent
    const conv = conversations.find((c) => c.id === convId);
    return 0; // Could be enhanced with actual unread count
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">الدعم والمحادثات</h1>
            <p className="text-muted-foreground">إدارة محادثات أولياء الأمور</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-4rem)]">
          {/* Conversations List */}
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader className="pb-3 border-b">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="open">مفتوح</SelectItem>
                    <SelectItem value="pending">في الانتظار</SelectItem>
                    <SelectItem value="closed">مغلق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              {loadingConversations ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
                  <p>لا توجد محادثات</p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="divide-y">
                    {filteredConversations.map((conv) => (
                      <button
                        key={conv.id}
                        className={`w-full p-4 text-right hover:bg-muted transition-colors ${
                          selectedConversation === conv.id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedConversation(conv.id)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <Badge 
                            variant={
                              conv.status === "open" ? "default" : 
                              conv.status === "pending" ? "secondary" : "outline"
                            }
                          >
                            {conv.status === "open" ? "مفتوح" : 
                             conv.status === "pending" ? "في الانتظار" : "مغلق"}
                          </Badge>
                          <div className="text-right">
                            <p className="font-medium">{conv.parent_accounts?.parent_name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                              {conv.subject || "بدون عنوان"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{format(new Date(conv.last_message_at), "HH:mm dd/MM", { locale: ar })}</span>
                          <span dir="ltr">{conv.parent_accounts?.father_phone}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-2 flex flex-col">
            {!selectedConversation ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
                <p>اختر محادثة للبدء</p>
              </div>
            ) : (
              <>
                <CardHeader className="border-b py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="lg:hidden"
                        onClick={() => setSelectedConversation(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {selectedConv?.parent_accounts?.parent_name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {selectedConv?.subject || "بدون عنوان"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`tel:${selectedConv?.parent_accounts?.father_phone}`}>
                        <Button variant="outline" size="icon">
                          <Phone className="h-4 w-4" />
                        </Button>
                      </a>
                      <Select
                        value={selectedConv?.status}
                        onValueChange={(v) => updateStatus.mutate(v)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">مفتوح</SelectItem>
                          <SelectItem value="pending">في الانتظار</SelectItem>
                          <SelectItem value="closed">مغلق</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p>لا توجد رسائل بعد</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_type === "employee" ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              msg.sender_type === "employee"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <div className={`flex items-center gap-1 text-xs mt-1 ${
                              msg.sender_type === "employee" ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}>
                              <span>{format(new Date(msg.created_at), "HH:mm", { locale: ar })}</span>
                              {msg.sender_type === "employee" && msg.is_read && (
                                <CheckCircle className="h-3 w-3" />
                              )}
                            </div>
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
                      placeholder="اكتب ردك..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sendMessage.isPending || selectedConv?.status === "closed"}
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={sendMessage.isPending || !newMessage.trim() || selectedConv?.status === "closed"}
                    >
                      {sendMessage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                  {selectedConv?.status === "closed" && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      هذه المحادثة مغلقة. قم بتغيير الحالة للرد.
                    </p>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}