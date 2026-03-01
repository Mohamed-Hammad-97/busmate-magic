import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Search, Headphones, Truck, Building2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const filteredChannels = channels.filter((ch) =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const getChannelIcon = (type: string) => {
    if (type === "seater_support") return <Headphones className="h-5 w-5 text-primary" />;
    if (type === "driver_chat") return <Truck className="h-5 w-5 text-blue-600" />;
    return <Building2 className="h-5 w-5 text-muted-foreground" />;
  };

  const getChannelIconBg = (type: string) => {
    if (type === "seater_support") return "bg-primary/10";
    if (type === "driver_chat") return "bg-blue-100 dark:bg-blue-900/30";
    return "bg-muted";
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return format(date, "hh:mm a");
    if (diffDays === 1) return "أمس";
    return format(date, "dd/MM");
  };

  // Sidebar
  const renderSidebar = () => (
    <div className={`flex flex-col bg-card rounded-2xl border border-border/50 shadow-lg overflow-hidden ${
      isMobile ? "w-full" : "w-[320px] shrink-0"
    }`}>
      {/* Search */}
      <div className="p-3 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المحادثات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-muted/40 border-0 rounded-xl text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {/* Channel list */}
      <ScrollArea className="flex-1">
        {filteredChannels.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm">لا توجد محادثات</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filteredChannels.map((ch) => {
              const isActive = selectedChannel?.id === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-right transition-colors hover:bg-muted/50 ${
                    isActive ? "bg-primary/5 border-r-2 border-r-primary" : ""
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getChannelIconBg(ch.type)}`}>
                    {getChannelIcon(ch.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                        {ch.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {ch.type === "seater_support" ? "الدعم الفني" : "محادثة السائق"}
                    </p>
                  </div>
                  {ch.unread > 0 && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] rounded-full px-1.5">
                      {ch.unread}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // Message area
  const renderMessageArea = () => {
    if (!selectedChannel) {
      return (
        <div className="flex-1 bg-card rounded-2xl border border-border/50 shadow-lg flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-base font-medium mb-1">اختر محادثة</p>
            <p className="text-sm">اختر محادثة من القائمة لبدء المراسلة</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 bg-card rounded-2xl border border-border/50 shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/30">
          {isMobile && (
            <Button variant="ghost" size="sm" className="h-8 px-2 -mr-2" onClick={() => setSelectedChannel(null)}>
              ←
            </Button>
          )}
          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getChannelIconBg(selectedChannel.type)}`}>
            {getChannelIcon(selectedChannel.type)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{selectedChannel.name}</p>
            <p className="text-xs text-green-500 font-medium">متصل</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-3">
            {messages_list.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-12">ابدأ المحادثة...</p>
            )}
            {messages_list.map((msg: any) => {
              const isMine = msg.sender_type === "company_account";
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}
                  >
                    {!isMine && (
                      <p className="text-[10px] font-semibold mb-0.5 text-muted-foreground">
                        {msg.sender_name}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    <p
                      className={`text-[10px] mt-1 text-left ${
                        isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                      }`}
                      dir="ltr"
                    >
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSend} className="px-5 py-3 border-t border-border/30 flex items-center gap-3">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب رسالتك..."
            className="flex-1 h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
            disabled={sendMutation.isPending}
          />
          <Button
            type="submit"
            size="default"
            disabled={sendMutation.isPending || !message.trim()}
            className="h-11 px-5 rounded-xl gap-1.5"
          >
            إرسال
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    );
  };

  // Mobile: show sidebar or messages
  if (isMobile) {
    return selectedChannel ? renderMessageArea() : renderSidebar();
  }

  // Desktop: side-by-side
  return (
    <div className="flex gap-4 h-[550px]">
      {renderSidebar()}
      {renderMessageArea()}
    </div>
  );
}
