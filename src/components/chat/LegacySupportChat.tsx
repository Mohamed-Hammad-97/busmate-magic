import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageCircle, Send, Loader2, User, 
  CheckCircle, Search, ArrowLeft, Phone
} from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

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

export function LegacySupportChat() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ar' ? ar : enUS;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["support-conversations", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("chat_conversations")
        .select(`*, parent_accounts (parent_name, father_phone)`)
        .order("last_message_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as Conversation[];
    },
  });

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

  useEffect(() => {
    if (!selectedConversation) return;
    const channel = supabase
      .channel(`support-messages-${selectedConversation}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `conversation_id=eq.${selectedConversation}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["support-messages", selectedConversation] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversation || !messages.length) return;
    const unread = messages.filter((m) => !m.is_read && m.sender_type === "parent");
    if (unread.length > 0) {
      supabase.from("chat_messages").update({ is_read: true })
        .in("id", unread.map((m) => m.id))
        .then(() => queryClient.invalidateQueries({ queryKey: ["support-messages", selectedConversation] }));
    }
  }, [selectedConversation, messages, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedConversation || !user?.id || !newMessage.trim()) return;
      await supabase.from("chat_messages").insert({
        conversation_id: selectedConversation,
        sender_type: "employee",
        sender_id: user.id,
        message: newMessage.trim(),
      });
      await supabase.from("chat_conversations")
        .update({ last_message_at: new Date().toISOString(), status: "pending" })
        .eq("id", selectedConversation);
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["support-conversations"] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!selectedConversation) return;
      await supabase.from("chat_conversations").update({ status }).eq("id", selectedConversation);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support-conversations"] }),
  });

  const filtered = conversations.filter((c) =>
    c.parent_accounts?.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
      {/* List */}
      <div className={`border-r flex flex-col ${selectedConversation ? "hidden lg:flex" : ""}`}>
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-3 opacity-40" />
              <p>No conversations</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((conv) => (
                <button
                  key={conv.id}
                  className={`w-full p-4 hover:bg-muted transition-colors text-left ${selectedConversation === conv.id ? "bg-muted" : ""}`}
                  onClick={() => setSelectedConversation(conv.id)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <Badge variant={conv.status === "open" ? "default" : conv.status === "pending" ? "secondary" : "outline"}>
                      {conv.status}
                    </Badge>
                    <p className="font-medium text-sm">{conv.parent_accounts?.parent_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.subject || "No subject"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(conv.last_message_at), "HH:mm dd/MM", { locale: dateLocale })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat */}
      <div className={`lg:col-span-2 flex flex-col ${!selectedConversation ? "hidden lg:flex" : ""}`}>
        {!selectedConversation ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
            <p>Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedConversation(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <p className="font-semibold text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />{selectedConv?.parent_accounts?.parent_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedConv?.subject || "No subject"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={`tel:${selectedConv?.parent_accounts?.father_phone}`}>
                  <Button variant="outline" size="icon"><Phone className="h-4 w-4" /></Button>
                </a>
                <Select value={selectedConv?.status} onValueChange={(v) => updateStatus.mutate(v)}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8"><p>No messages yet</p></div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_type === "employee" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.sender_type === "employee" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p className="text-sm">{msg.message}</p>
                        <div className={`flex items-center gap-1 text-xs mt-1 ${msg.sender_type === "employee" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          <span>{format(new Date(msg.created_at), "HH:mm", { locale: dateLocale })}</span>
                          {msg.sender_type === "employee" && msg.is_read && <CheckCircle className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            <div className="p-4 border-t">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage.mutate(); }} className="flex gap-2">
                <Input
                  placeholder={selectedConv?.status === "closed" ? "Conversation closed" : "Type a reply..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sendMessage.isPending || selectedConv?.status === "closed"}
                />
                <Button type="submit" size="icon" disabled={sendMessage.isPending || !newMessage.trim() || selectedConv?.status === "closed"}>
                  {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
