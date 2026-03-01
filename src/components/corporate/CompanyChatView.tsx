import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, ArrowRight, Headphones, Truck, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface ChatChannel {
  id: string;
  type: string;
  ref_id: string | null;
  name: string;
  phone?: string;
  unread: number;
}

export function CompanyChatView() {
  const { token, account } = useCompanyAuth();
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch channels
  const { data: channelsData } = useQuery({
    queryKey: ["company-portal", "get-chat-channels"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: { action: "get-chat-channels" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!token,
    refetchInterval: 10000,
  });

  const channels: ChatChannel[] = channelsData?.channels || [];

  // Fetch messages for selected channel
  const { data: messagesData, refetch: refetchMessages } = useQuery({
    queryKey: ["company-chat-messages", selectedChannel?.id],
    queryFn: async () => {
      if (!selectedChannel) return { messages: [] };
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: {
          action: "get-chat-messages",
          data: {
            channel_type: selectedChannel.type,
            channel_ref_id: selectedChannel.ref_id,
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!token && !!selectedChannel,
    refetchInterval: 5000,
  });

  const messages_list = messagesData?.messages || [];

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChannel || !message.trim()) return;
      const { data, error } = await supabase.functions.invoke("company-portal-data", {
        body: {
          action: "send-chat-message",
          data: {
            channel_type: selectedChannel.type,
            channel_ref_id: selectedChannel.ref_id,
            message: message.trim(),
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setMessage("");
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["company-portal", "get-chat-channels"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages_list]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) sendMutation.mutate();
  };

  // Channel list view
  if (!selectedChannel) {
    return (
      <div className="space-y-3">
        {channels.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium mb-1">لا توجد محادثات</p>
              <p className="text-sm">ستظهر قنوات المحادثة عند تعيين سائقين لخطوطك</p>
            </CardContent>
          </Card>
        ) : (
          channels.map((ch) => (
            <Card
              key={ch.id}
              className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedChannel(ch)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  ch.type === "seater_support"
                    ? "bg-primary/10"
                    : "bg-blue-100 dark:bg-blue-900/30"
                }`}>
                  {ch.type === "seater_support" ? (
                    <Headphones className="h-5 w-5 text-primary" />
                  ) : (
                    <Truck className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{ch.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ch.type === "seater_support" ? "الدعم الفني" : "محادثة السائق"}
                  </p>
                </div>
                {ch.unread > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-xs">{ch.unread}</Badge>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex flex-col h-[500px]">
      {/* Chat header */}
      <div className="flex items-center gap-3 p-3 border-b bg-muted/30 rounded-t-xl">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedChannel(null)}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
          selectedChannel.type === "seater_support" ? "bg-primary/10" : "bg-blue-100 dark:bg-blue-900/30"
        }`}>
          {selectedChannel.type === "seater_support" ? (
            <Headphones className="h-4 w-4 text-primary" />
          ) : (
            <Truck className="h-4 w-4 text-blue-600" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{selectedChannel.name}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages_list.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">ابدأ المحادثة...</p>
          )}
          {messages_list.map((msg: any) => {
            const isMine = msg.sender_type === "company_account";
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                }`}>
                  {!isMine && (
                    <p className={`text-[10px] font-medium mb-0.5 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {msg.sender_name}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ar })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب رسالتك..."
          className="flex-1"
          disabled={sendMutation.isPending}
        />
        <Button type="submit" size="icon" disabled={sendMutation.isPending || !message.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
