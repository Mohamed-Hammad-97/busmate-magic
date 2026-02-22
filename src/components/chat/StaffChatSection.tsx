import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, MessageCircle, User, Plus } from "lucide-react";
import { ChatMessageView } from "./ChatMessageView";
import { format } from "date-fns";

interface StaffMember {
  id: string;
  full_name: string;
  phone: string;
  type: "driver" | "supervisor";
}

export function StaffChatSection() {
  const { user, employee } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedStaffName, setSelectedStaffName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showStaffList, setShowStaffList] = useState(false);

  // Fetch existing staff conversations
  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["staff-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_conversations")
        .select(`*, conversation_participants(*)`)
        .eq("type", "staff_dm")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all drivers and supervisors
  const { data: drivers = [] } = useQuery({
    queryKey: ["all-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("id, full_name, phone").eq("is_active", true);
      if (error) throw error;
      return data.map((d) => ({ ...d, type: "driver" as const }));
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ["all-supervisors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supervisors").select("id, full_name, phone").eq("is_active", true);
      if (error) throw error;
      return data.map((s) => ({ ...s, type: "supervisor" as const }));
    },
  });

  const allStaff: StaffMember[] = [...drivers, ...supervisors];

  const filteredStaff = allStaff.filter((s) =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Start or resume a DM with a staff member
  const startChat = useMutation({
    mutationFn: async (staff: StaffMember) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Find driver_account user_id for this staff member
      let staffUserId: string | null = null;
      const { data: accounts } = await supabase
        .from("driver_accounts")
        .select("user_id")
        .eq(staff.type === "driver" ? "driver_id" : "supervisor_id", staff.id)
        .eq("is_active", true)
        .maybeSingle();
      staffUserId = accounts?.user_id || null;

      // Check if conversation already exists between these two
      if (staffUserId) {
        const { data: existing } = await supabase
          .from("unified_conversations")
          .select("id, conversation_participants!inner(*)")
          .eq("type", "staff_dm");

        if (existing) {
          for (const conv of existing) {
            const participants = (conv as any).conversation_participants || [];
            const hasMe = participants.some((p: any) => p.user_id === user.id);
            const hasStaff = participants.some((p: any) => p.user_id === staffUserId);
            if (hasMe && hasStaff) {
              return { conversationId: conv.id, name: staff.full_name };
            }
          }
        }
      }

      // Create new conversation
      const { data: conv, error: convError } = await supabase
        .from("unified_conversations")
        .insert({
          type: "staff_dm" as any,
          subject: `Chat with ${staff.full_name}`,
          created_by: user.id,
        })
        .select()
        .single();
      if (convError) throw convError;

      // Add participants
      const participants = [
        {
          conversation_id: conv.id,
          user_id: user.id,
          participant_type: "employee",
          participant_ref_id: employee?.id || null,
          can_send: true,
        },
      ];

      if (staffUserId) {
        participants.push({
          conversation_id: conv.id,
          user_id: staffUserId,
          participant_type: staff.type,
          participant_ref_id: staff.id,
          can_send: true,
        });
      }

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert(participants);
      if (partError) throw partError;

      return { conversationId: conv.id, name: staff.full_name };
    },
    onSuccess: (result) => {
      if (result) {
        setSelectedConversation(result.conversationId);
        setSelectedStaffName(result.name);
        setShowStaffList(false);
        queryClient.invalidateQueries({ queryKey: ["staff-conversations"] });
      }
    },
  });

  if (selectedConversation) {
    return (
      <ChatMessageView
        conversationId={selectedConversation}
        senderType="employee"
        onBack={() => setSelectedConversation(null)}
        title={selectedStaffName || "Staff Chat"}
        subtitle="Direct Message"
      />
    );
  }

  if (showStaffList) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowStaffList(false)}>
            ← Back
          </Button>
          <p className="font-semibold">Select Staff Member</p>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers & supervisors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-2 pb-4">
            {filteredStaff.map((staff) => (
              <button
                key={`${staff.type}-${staff.id}`}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                onClick={() => startChat.mutate(staff)}
                disabled={startChat.isPending}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{staff.full_name}</p>
                  <p className="text-xs text-muted-foreground">{staff.phone}</p>
                </div>
                <Badge variant="outline" className="capitalize text-xs">{staff.type}</Badge>
              </button>
            ))}
            {filteredStaff.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No staff members found</p>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <p className="font-semibold">Staff Chats</p>
        <Button size="sm" onClick={() => setShowStaffList(true)} className="gap-1">
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
            <p>No staff conversations yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowStaffList(true)}>
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
                  setSelectedStaffName(conv.subject?.replace("Chat with ", "") || "Staff");
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conv.subject || "Staff Chat"}</p>
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
