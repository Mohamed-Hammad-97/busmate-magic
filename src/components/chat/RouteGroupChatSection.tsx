import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, MessageCircle, Users, Plus, Settings, Bus } from "lucide-react";
import { ChatMessageView } from "./ChatMessageView";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RouteGroupChatSection() {
  const { user, employee } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState("");

  // Fetch group conversations
  const { data: groupConversations = [], isLoading } = useQuery({
    queryKey: ["route-group-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_conversations")
        .select(`*, conversation_participants(*)`)
        .eq("type", "route_group")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch routes for creating groups
  const { data: routes = [] } = useQuery({
    queryKey: ["routes-for-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`id, name, school_id, driver_id, supervisor_id, schools(name)`)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Create group chat for a route
  const createGroupChat = useMutation({
    mutationFn: async (routeId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if group already exists for this route
      const { data: existing } = await supabase
        .from("unified_conversations")
        .select("id")
        .eq("type", "route_group")
        .eq("route_id", routeId)
        .maybeSingle();

      if (existing) throw new Error("Group chat already exists for this route");

      const route = routes.find((r) => r.id === routeId);
      if (!route) throw new Error("Route not found");

      // Create conversation
      const { data: conv, error: convError } = await supabase
        .from("unified_conversations")
        .insert({
          type: "route_group" as any,
          route_id: routeId,
          subject: `${route.name} - Group Chat`,
          allow_customer_messages: false,
          created_by: user.id,
        })
        .select()
        .single();
      if (convError) throw convError;

      // Add employee as participant
      const participants: any[] = [
        {
          conversation_id: conv.id,
          user_id: user.id,
          participant_type: "employee",
          participant_ref_id: employee?.id,
          can_send: true,
        },
      ];

      // Add supervisor if exists
      if (route.supervisor_id) {
        const { data: supAccount } = await supabase
          .from("driver_accounts")
          .select("user_id")
          .eq("supervisor_id", route.supervisor_id)
          .eq("is_active", true)
          .maybeSingle();
        if (supAccount?.user_id) {
          participants.push({
            conversation_id: conv.id,
            user_id: supAccount.user_id,
            participant_type: "supervisor",
            participant_ref_id: route.supervisor_id,
            can_send: true,
          });
        }
      }

      // Add customers from route assignments
      const { data: assignments } = await supabase
        .from("route_assignments")
        .select("registration_id, registrations(parent_id, parent_accounts(id, user_id))")
        .eq("route_id", routeId);

      if (assignments) {
        const addedUserIds = new Set(participants.map((p) => p.user_id));
        for (const assignment of assignments) {
          const parent = (assignment as any).registrations?.parent_accounts;
          if (parent?.user_id && !addedUserIds.has(parent.user_id)) {
            participants.push({
              conversation_id: conv.id,
              user_id: parent.user_id,
              participant_type: "parent",
              participant_ref_id: parent.id,
              can_send: false, // Customers receive only by default
            });
            addedUserIds.add(parent.user_id);
          }
        }
      }

      await supabase.from("conversation_participants").insert(participants);
      return conv;
    },
    onSuccess: () => {
      setShowCreateDialog(false);
      setSelectedRouteId("");
      queryClient.invalidateQueries({ queryKey: ["route-group-conversations"] });
    },
  });

  // Toggle customer messaging
  const toggleCustomerMessages = useMutation({
    mutationFn: async ({ conversationId, allow }: { conversationId: string; allow: boolean }) => {
      // Update conversation setting
      await supabase
        .from("unified_conversations")
        .update({ allow_customer_messages: allow })
        .eq("id", conversationId);

      // Update all parent participants
      await supabase
        .from("conversation_participants")
        .update({ can_send: allow })
        .eq("conversation_id", conversationId)
        .eq("participant_type", "parent");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-group-conversations"] });
    },
  });

  if (selectedConversation) {
    const conv = groupConversations.find((c: any) => c.id === selectedConversation);
    return (
      <ChatMessageView
        conversationId={selectedConversation}
        senderType="employee"
        onBack={() => setSelectedConversation(null)}
        title={selectedGroupName || "Group Chat"}
        subtitle={`${(conv as any)?.conversation_participants?.length || 0} members`}
        headerActions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Customer Messages</span>
            <Switch
              checked={conv?.allow_customer_messages || false}
              onCheckedChange={(checked) =>
                toggleCustomerMessages.mutate({ conversationId: selectedConversation, allow: checked })
              }
            />
          </div>
        }
      />
    );
  }

  // Available routes for which no group exists
  const existingRouteIds = new Set(groupConversations.map((c: any) => c.route_id));
  const availableRoutes = routes.filter((r) => !existingRouteIds.has(r.id));

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <p className="font-semibold">Route Group Chats</p>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" disabled={availableRoutes.length === 0}>
              <Plus className="h-4 w-4" /> Create Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Route Group Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Route</label>
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a route..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.name} — {(route as any).schools?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                This will create a group chat with all customers on this route, the supervisor, and customer support staff.
                Customers will receive messages only by default.
              </p>
              <Button
                className="w-full"
                onClick={() => createGroupChat.mutate(selectedRouteId)}
                disabled={!selectedRouteId || createGroupChat.isPending}
              >
                {createGroupChat.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Group Chat
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : groupConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-3 opacity-40" />
            <p>No route group chats yet</p>
            <p className="text-sm">Create a group chat for a route to get started</p>
          </div>
        ) : (
          <div className="divide-y">
            {groupConversations.map((conv: any) => (
              <button
                key={conv.id}
                className="w-full p-4 hover:bg-muted transition-colors text-left"
                onClick={() => {
                  setSelectedConversation(conv.id);
                  setSelectedGroupName(conv.subject || "Group Chat");
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conv.subject || "Route Group"}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {conv.conversation_participants?.length || 0} members
                      </p>
                      <Badge variant={conv.allow_customer_messages ? "default" : "secondary"} className="text-[10px]">
                        {conv.allow_customer_messages ? "Customers can chat" : "Receive only"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {conv.last_message_at ? format(new Date(conv.last_message_at), "dd MMM") : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
