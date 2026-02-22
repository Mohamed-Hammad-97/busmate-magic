import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHero } from "@/components/layout/PageHero";
import { MessageCircle, Users, UserCircle, Bus, Headphones } from "lucide-react";
import { StaffChatSection } from "@/components/chat/StaffChatSection";
import { CustomerChatSection } from "@/components/chat/CustomerChatSection";
import { RouteGroupChatSection } from "@/components/chat/RouteGroupChatSection";
import { LegacySupportChat } from "@/components/chat/LegacySupportChat";

export default function SupportChat() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <div className="mb-4">
          <PageHero
            icon={MessageCircle}
            title="Support & Communications"
            description="Manage all chat channels — staff, customers, and route groups"
          />
        </div>

        <Tabs defaultValue="staff" className="h-[calc(100%-4rem)]">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="staff" className="gap-2">
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Staff Chat</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Customer Chat</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Bus className="h-4 w-4" />
              <span className="hidden sm:inline">Route Groups</span>
            </TabsTrigger>
            <TabsTrigger value="legacy" className="gap-2">
              <Headphones className="h-4 w-4" />
              <span className="hidden sm:inline">Support Inbox</span>
            </TabsTrigger>
          </TabsList>

          <Card className="h-[calc(100%-3.5rem)] overflow-hidden">
            <TabsContent value="staff" className="h-full m-0">
              <StaffChatSection />
            </TabsContent>
            <TabsContent value="customers" className="h-full m-0">
              <CustomerChatSection />
            </TabsContent>
            <TabsContent value="groups" className="h-full m-0">
              <RouteGroupChatSection />
            </TabsContent>
            <TabsContent value="legacy" className="h-full m-0">
              <LegacySupportChat />
            </TabsContent>
          </Card>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
