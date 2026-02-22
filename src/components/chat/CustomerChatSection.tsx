import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, MessageCircle, User, Plus, Phone } from "lucide-react";
import { ChatMessageView } from "./ChatMessageView";
import { format } from "date-fns";

export function CustomerChatSection() {
  const { user, employee } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCustomerList, setShowCustomerList] = useState(false);

  // Fetch existing customer conversations (unified)
  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["customer-dm-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_conversations")
        .select(`*, conversation_participants(*)`)
        .eq("type", "customer_dm")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all parent accounts (customers)
  const { data: customers = [] } = useQuery({
    queryKey: ["all-customers-for-chat"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_accounts")
        .select("id, parent_name, father_phone, city, user_id")
        .order("parent_name");
      if (error) throw error;
      return data;
    },
  });

  const filteredCustomers = customers.filter((c) =>
    c.parent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.father_phone.includes(searchTerm)
  );

  const startChat = useMutation({
    mutationFn: async (customer: typeof customers[0]) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if DM already exists
      if (customer.user_id) {
        const { data: existing } = await supabase
          .from("unified_conversations")
          .select("id, conversation_participants!inner(*)")
          .eq("type", "customer_dm");

        if (existing) {
          for (const conv of existing) {
            const participants = (conv as any).conversation_participants || [];
            const hasCustomer = participants.some((p: any) => p.user_id === customer.user_id);
            const hasMe = participants.some((p: any) => p.user_id === user.id);
            if (hasCustomer && hasMe) {
              return { conversationId: conv.id, name: customer.parent_name };
            }
          }
        }
      }

      // Create new conversation
      const { data: conv, error: convError } = await supabase
        .from("unified_conversations")
        .insert({
          type: "customer_dm" as any,
          subject: `Chat with ${customer.parent_name}`,
          created_by: user.id,
        })
        .select()
        .single();
      if (convError) throw convError;

      // Add participants
      const participants: any[] = [
        {
          conversation_id: conv.id,
          user_id: user.id,
          participant_type: "employee",
          participant_ref_id: employee?.id || null,
          can_send: true,
        },
      ];

      if (customer.user_id) {
        participants.push({
          conversation_id: conv.id,
          user_id: customer.user_id,
          participant_type: "parent",
          participant_ref_id: customer.id,
          can_send: true,
        });
      }

      await supabase.from("conversation_participants").insert(participants);

      return { conversationId: conv.id, name: customer.parent_name };
    },
    onSuccess: (result) => {
      if (result) {
        setSelectedConversation(result.conversationId);
        setSelectedCustomerName(result.name);
        setShowCustomerList(false);
        queryClient.invalidateQueries({ queryKey: ["customer-dm-conversations"] });
      }
    },
  });

  if (selectedConversation) {
    return (
      <ChatMessageView
        conversationId={selectedConversation}
        senderType="employee"
        onBack={() => setSelectedConversation(null)}
        title={selectedCustomerName || "Customer Chat"}
        subtitle="Direct Message"
      />
    );
  }

  if (showCustomerList) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowCustomerList(false)}>
            ← Back
          </Button>
          <p className="font-semibold">Select Customer</p>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-2 pb-4">
            {filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                onClick={() => startChat.mutate(customer)}
                disabled={startChat.isPending}
              >
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{customer.parent_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span dir="ltr">{customer.father_phone}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{customer.city}</Badge>
              </button>
            ))}
            {filteredCustomers.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No customers found</p>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <p className="font-semibold">Customer Chats</p>
        <Button size="sm" onClick={() => setShowCustomerList(true)} className="gap-1">
          <Plus className="h-4 w-4" /> New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loadingConvs ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-3 opacity-40" />
            <p>No customer conversations yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCustomerList(true)}>
              Start a Chat
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conv: any) => (
              <button
                key={conv.id}
                className="w-full p-4 hover:bg-muted transition-colors text-left"
                onClick={() => {
                  setSelectedConversation(conv.id);
                  setSelectedCustomerName(conv.subject?.replace("Chat with ", "") || "Customer");
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conv.subject || "Customer Chat"}</p>
                    <p className="text-xs text-muted-foreground">
                      {conv.last_message_at ? format(new Date(conv.last_message_at), "dd MMM HH:mm") : "No messages"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
