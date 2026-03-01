import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle, Send, Loader2, Plus, ArrowLeft,
  User, Search, Headphones, Bus, Building2,
} from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

export function ParentChat() {
  const { parentAccount, user } = useParentAuth();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Fetch conversations where this parent is a participant
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["parent-unified-conversations", user?.id],
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
          return { ...convo, lastMessage: lastMsg, unreadCount: count || 0 };
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
      return (data || []).map((c) => ({ ...c, isLegacy: true }));
    },
    enabled: !!parentAccount?.id,
  });

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
        return (data || []).map((m) => ({ ...m, sender_name: m.sender_type === "parent" ? parentAccount?.parent_name : "Support", isLegacy: true }));
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
        await supabase.from("unified_messages").insert({
          conversation_id: selectedConversationId, sender_id: user.id, sender_type: "parent",
          sender_name: parentAccount?.parent_name || "Parent", message: newMessage.trim(),
        });
        await supabase.from("unified_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", selectedConversationId);
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["parent-chat-messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["parent-unified-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["parent-legacy-conversations"] });
    },
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user");
      const { data: convo, error } = await supabase
        .from("unified_conversations")
        .insert({ type: "customer_supervisor" as any, subject: newSubject || "New Conversation", created_by: user.id })
        .select().single();
      if (error) throw error;
      await supabase.from("conversation_participants").insert({
        conversation_id: convo.id, user_id: user.id, participant_type: "parent", participant_ref_id: parentAccount?.id, can_send: true,
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

  const allConversations = [
    ...conversations.map((c) => ({ ...c, isLegacy: false })),
    ...legacyConversations,
  ];

  const filteredConversations = allConversations.filter((c: any) =>
    !searchTerm || (c.subject || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getConvoIcon = (conv: any) => {
    if (conv.type === "route_group") return <Bus className="h-5 w-5 text-primary" />;
    if (conv.type === "customer_dm") return <Building2 className="h-5 w-5 text-primary" />;
    return <Headphones className="h-5 w-5 text-primary" />;
  };

  const currentConvo = allConversations.find((c: any) => c.id === selectedConversationId);

  // --- Split panel layout ---
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl bg-muted/50 border-0 h-9 text-sm"
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-4">
            <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No conversations</p>
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
                    <span className="font-medium text-sm truncate">{conv.subject || "Chat"}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {format(new Date(conv.last_message_at || conv.created_at), "hh:mm a")}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage.message}
                    </p>
                  )}
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

      {/* New chat button */}
      <div className="p-3 border-t">
        <Button size="sm" className="w-full gap-2" onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4" /> New Chat
        </Button>
      </div>
    </div>
  );

  const messageAreaContent = () => {
    if (isCreating) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
          <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
          <h3 className="font-semibold text-lg">New Conversation</h3>
          <div className="w-full max-w-sm space-y-3">
            <Input
              placeholder="Subject (e.g. Fee inquiry)"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="rounded-xl"
            />
            <Button className="w-full" onClick={() => createConversation.mutate()} disabled={createConversation.isPending}>
              {createConversation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Conversation
            </Button>
          </div>
        </div>
      );
    }

    if (!selectedConversationId) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <MessageCircle className="h-16 w-16 mb-3 opacity-20" />
          <p className="font-medium">Select a conversation</p>
          <p className="text-sm">Choose a chat from the sidebar to start messaging</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Chat header */}
        <div className="p-4 border-b flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSelectedConversationId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            {currentConvo && getConvoIcon(currentConvo)}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{currentConvo?.subject || "Chat"}</h3>
            <p className="text-xs text-green-600">Online</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">Start the conversation by sending a message</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: any) => {
                const isMe = msg.sender_id === user?.id || msg.sender_type === "parent";
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

        {/* Input */}
        <div className="p-3 border-t">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage.mutate(); }} className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sendMessage.isPending}
              className="rounded-xl flex-1"
            />
            <Button type="submit" size="sm" className="rounded-xl px-5 shrink-0" disabled={sendMessage.isPending || !newMessage.trim()}>
              {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </form>
        </div>
      </div>
    );
  };

  // Mobile: show sidebar or message area
  if (isMobile) {
    if (selectedConversationId || isCreating) {
      return (
        <div className="border rounded-2xl shadow-md bg-background overflow-hidden h-[500px]">
          {messageAreaContent()}
        </div>
      );
    }
    return (
      <div className="border rounded-2xl shadow-md bg-background overflow-hidden h-[500px]">
        {sidebarContent}
      </div>
    );
  }

  // Desktop: split panel
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