import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ImageUploadInput } from "@/components/shared/ImageUploadInput";
import { 
  Save, 
  Plus, 
  Trash2, 
  Edit, 
  Image, 
  Users, 
  Settings, 
  MessageSquare,
  Eye,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface HomepageSetting {
  id: string;
  key: string;
  value: string | null;
}

interface Partner {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  display_order: number;
  is_active: boolean;
}

interface GalleryImage {
  id: string;
  title: string | null;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_active: boolean;
}

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const HomepageAdmin = () => {
  const queryClient = useQueryClient();
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [editingGallery, setEditingGallery] = useState<GalleryImage | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["homepage-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_settings")
        .select("*");
      if (error) throw error;
      return data as HomepageSetting[];
    },
  });

  // Fetch partners
  const { data: partners, isLoading: partnersLoading } = useQuery({
    queryKey: ["homepage-partners-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_partners")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as Partner[];
    },
  });

  // Fetch gallery
  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ["homepage-gallery-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_gallery")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as GalleryImage[];
    },
  });

  // Fetch contact submissions
  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ["contact-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContactSubmission[];
    },
  });

  // Initialize form with settings
  useEffect(() => {
    if (settings) {
      const formData: Record<string, string> = {};
      settings.forEach((s) => {
        formData[s.key] = s.value || "";
      });
      setSettingsForm(formData);
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: { key: string; value: string }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("homepage_settings")
          .update({ value: update.value || null })
          .eq("key", update.key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage-settings"] });
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  // Partner mutations
  const savePartnerMutation = useMutation({
    mutationFn: async (partner: Partial<Partner>) => {
      if (partner.id) {
        const { error } = await supabase
          .from("homepage_partners")
          .update(partner)
          .eq("id", partner.id);
        if (error) throw error;
      } else {
        const { name, logo_url, website_url, display_order, is_active } = partner;
        const { error } = await supabase
          .from("homepage_partners")
          .insert({ name: name!, logo_url, website_url, display_order: display_order || 0, is_active: is_active ?? true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage-partners-admin"] });
      setPartnerDialogOpen(false);
      setEditingPartner(null);
      toast.success("Partner saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save partner: " + error.message);
    },
  });

  const deletePartnerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("homepage_partners")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage-partners-admin"] });
      toast.success("Partner deleted");
    },
  });

  // Gallery mutations
  const saveGalleryMutation = useMutation({
    mutationFn: async (image: Partial<GalleryImage>) => {
      if (image.id) {
        const { error } = await supabase
          .from("homepage_gallery")
          .update(image)
          .eq("id", image.id);
        if (error) throw error;
      } else {
        const { title, image_url, alt_text, display_order, is_active } = image;
        const { error } = await supabase
          .from("homepage_gallery")
          .insert({ title, image_url: image_url!, alt_text, display_order: display_order || 0, is_active: is_active ?? true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage-gallery-admin"] });
      setGalleryDialogOpen(false);
      setEditingGallery(null);
      toast.success("Gallery image saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save gallery image: " + error.message);
    },
  });

  const deleteGalleryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("homepage_gallery")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage-gallery-admin"] });
      toast.success("Gallery image deleted");
    },
  });

  // Update submission status
  const updateSubmissionMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("contact_submissions")
        .update({ status, notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-submissions"] });
      setSelectedSubmission(null);
      toast.success("Submission updated");
    },
  });

  const handleSaveSettings = () => {
    const updates = Object.entries(settingsForm).map(([key, value]) => ({
      key,
      value,
    }));
    updateSettingsMutation.mutate(updates);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="default" className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />New</Badge>;
      case "in_progress":
        return <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "resolved":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
      case "closed":
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Homepage Management</h1>
          <p className="text-muted-foreground">Manage your landing page content</p>
        </div>

        <Tabs defaultValue="settings">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="partners" className="gap-2">
              <Users className="h-4 w-4" />
              Partners
            </TabsTrigger>
            <TabsTrigger value="gallery" className="gap-2">
              <Image className="h-4 w-4" />
              Gallery
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Submissions
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Hero Title</Label>
                  <Input
                    value={settingsForm.hero_title || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hero_title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hero Subtitle</Label>
                  <Textarea
                    value={settingsForm.hero_subtitle || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hero_subtitle: e.target.value })}
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Stats - Users</Label>
                    <Input
                      value={settingsForm.stats_users || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, stats_users: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stats - Schools</Label>
                    <Input
                      value={settingsForm.stats_schools || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, stats_schools: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stats - Cities</Label>
                    <Input
                      value={settingsForm.stats_cities || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, stats_cities: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About Section</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>About Title</Label>
                  <Input
                    value={settingsForm.about_title || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, about_title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>About Text</Label>
                  <Textarea
                    rows={4}
                    value={settingsForm.about_text || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, about_text: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>About Section Image</Label>
                  <p className="text-sm text-muted-foreground">Leave empty to use the second gallery image as fallback</p>
                <ImageUploadInput
                    value={settingsForm.about_image || ""}
                    onChange={(url) => setSettingsForm({ ...settingsForm, about_image: url })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SEO Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">These settings control how your website appears in search engines and when shared on social media.</p>
                <div className="space-y-2">
                  <Label>Page Title</Label>
                  <Input
                    placeholder="Seater - Smart School & Corporate Transportation"
                    value={settingsForm.seo_title || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, seo_title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meta Description</Label>
                  <Textarea
                    rows={3}
                    placeholder="A brief description of your website for search engines..."
                    value={settingsForm.seo_description || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, seo_description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Keywords</Label>
                  <Input
                    placeholder="school bus, transportation, fleet management, GPS tracking"
                    value={settingsForm.seo_keywords || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, seo_keywords: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Separate keywords with commas</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>App Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Leave empty to hide the button</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>App Store URL</Label>
                    <Input
                      placeholder="https://apps.apple.com/..."
                      value={settingsForm.app_store_url || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, app_store_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Google Play URL</Label>
                    <Input
                      placeholder="https://play.google.com/..."
                      value={settingsForm.google_play_url || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, google_play_url: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Leave empty to hide the icon. Icons will only appear in the footer when at least one link is provided.</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Facebook</Label>
                    <Input
                      placeholder="https://facebook.com/..."
                      value={settingsForm.social_facebook || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, social_facebook: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Twitter / X</Label>
                    <Input
                      placeholder="https://twitter.com/..."
                      value={settingsForm.social_twitter || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, social_twitter: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input
                      placeholder="https://instagram.com/..."
                      value={settingsForm.social_instagram || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, social_instagram: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn</Label>
                    <Input
                      placeholder="https://linkedin.com/company/..."
                      value={settingsForm.social_linkedin || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, social_linkedin: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>YouTube</Label>
                    <Input
                      placeholder="https://youtube.com/..."
                      value={settingsForm.social_youtube || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, social_youtube: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TikTok</Label>
                    <Input
                      placeholder="https://tiktok.com/@..."
                      value={settingsForm.social_tiktok || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, social_tiktok: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information - Cairo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={settingsForm.cairo_address || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, cairo_address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={settingsForm.cairo_phone || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, cairo_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={settingsForm.cairo_email || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, cairo_email: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information - Alexandria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={settingsForm.alex_address || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, alex_address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={settingsForm.alex_phone || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, alex_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={settingsForm.alex_email || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, alex_email: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              Save All Settings
            </Button>
          </TabsContent>

          {/* Partners Tab */}
          <TabsContent value="partners" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Partners & Clients</h2>
              <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingPartner(null)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Partner
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingPartner ? "Edit Partner" : "Add Partner"}</DialogTitle>
                  </DialogHeader>
                  <PartnerForm
                    partner={editingPartner}
                    onSave={(data) => savePartnerMutation.mutate(data)}
                    isPending={savePartnerMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Logo URL</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners?.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{partner.logo_url || "-"}</TableCell>
                      <TableCell>{partner.display_order}</TableCell>
                      <TableCell>
                        <Badge variant={partner.is_active ? "default" : "secondary"}>
                          {partner.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingPartner(partner);
                              setPartnerDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePartnerMutation.mutate(partner.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!partners || partners.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No partners added yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Gallery Images</h2>
              <Dialog open={galleryDialogOpen} onOpenChange={setGalleryDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingGallery(null)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Image
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingGallery ? "Edit Image" : "Add Image"}</DialogTitle>
                  </DialogHeader>
                  <GalleryForm
                    image={editingGallery}
                    onSave={(data) => saveGalleryMutation.mutate(data)}
                    isPending={saveGalleryMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gallery?.map((image) => (
                <Card key={image.id} className={!image.is_active ? "opacity-50" : ""}>
                  <CardContent className="p-4 space-y-3">
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      {image.image_url ? (
                        <img src={image.image_url} alt={image.alt_text || ""} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{image.title || "Untitled"}</p>
                    <div className="flex justify-between items-center">
                      <Badge variant={image.is_active ? "default" : "secondary"}>
                        {image.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingGallery(image);
                            setGalleryDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteGalleryMutation.mutate(image.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!gallery || gallery.length === 0) && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No gallery images added yet
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Submissions Tab */}
          <TabsContent value="submissions" className="space-y-4">
            <h2 className="text-xl font-semibold">Contact Form Submissions</h2>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions?.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>{format(new Date(submission.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-medium">{submission.name}</TableCell>
                      <TableCell>{submission.email}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{submission.subject || "-"}</TableCell>
                      <TableCell>{getStatusBadge(submission.status)}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(submission)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Contact Submission</DialogTitle>
                            </DialogHeader>
                            <SubmissionDetails
                              submission={submission}
                              onUpdate={(status, notes) =>
                                updateSubmissionMutation.mutate({ id: submission.id, status, notes })
                              }
                              isPending={updateSubmissionMutation.isPending}
                            />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!submissions || submissions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No submissions yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

// Partner Form Component
const PartnerForm = ({
  partner,
  onSave,
  isPending,
}: {
  partner: Partner | null;
  onSave: (data: Partial<Partner>) => void;
  isPending: boolean;
}) => {
  const [form, setForm] = useState({
    name: partner?.name || "",
    logo_url: partner?.logo_url || "",
    website_url: partner?.website_url || "",
    display_order: partner?.display_order || 0,
    is_active: partner?.is_active ?? true,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>
      <ImageUploadInput
        label="Logo"
        value={form.logo_url}
        onChange={(url) => setForm({ ...form, logo_url: url })}
        folder="partners"
        previewVariant="logo"
      />
      <div className="space-y-2">
        <Label>Website URL</Label>
        <Input
          value={form.website_url}
          onChange={(e) => setForm({ ...form, website_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label>Display Order</Label>
        <Input
          type="number"
          value={form.display_order}
          onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={form.is_active}
          onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
        />
        <Label>Active</Label>
      </div>
      <Button
        className="w-full"
        onClick={() => onSave({ ...form, id: partner?.id })}
        disabled={isPending || !form.name}
      >
        {isPending ? "Saving..." : "Save Partner"}
      </Button>
    </div>
  );
};

// Gallery Form Component
const GalleryForm = ({
  image,
  onSave,
  isPending,
}: {
  image: GalleryImage | null;
  onSave: (data: Partial<GalleryImage>) => void;
  isPending: boolean;
}) => {
  const [form, setForm] = useState({
    title: image?.title || "",
    image_url: image?.image_url || "",
    alt_text: image?.alt_text || "",
    display_order: image?.display_order || 0,
    is_active: image?.is_active ?? true,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <ImageUploadInput
        label="Image"
        value={form.image_url}
        onChange={(url) => setForm({ ...form, image_url: url })}
        folder="gallery"
        required
      />
      <div className="space-y-2">
        <Label>Alt Text</Label>
        <Input
          value={form.alt_text}
          onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Display Order</Label>
        <Input
          type="number"
          value={form.display_order}
          onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={form.is_active}
          onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
        />
        <Label>Active</Label>
      </div>
      <Button
        className="w-full"
        onClick={() => onSave({ ...form, id: image?.id })}
        disabled={isPending || !form.image_url}
      >
        {isPending ? "Saving..." : "Save Image"}
      </Button>
    </div>
  );
};

// Submission Details Component
const SubmissionDetails = ({
  submission,
  onUpdate,
  isPending,
}: {
  submission: ContactSubmission;
  onUpdate: (status: string, notes?: string) => void;
  isPending: boolean;
}) => {
  const [status, setStatus] = useState(submission.status);
  const [notes, setNotes] = useState(submission.notes || "");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground">Name</Label>
          <p className="font-medium">{submission.name}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Email</Label>
          <p className="font-medium">{submission.email}</p>
        </div>
      </div>
      <div>
        <Label className="text-muted-foreground">Subject</Label>
        <p className="font-medium">{submission.subject || "-"}</p>
      </div>
      <div>
        <Label className="text-muted-foreground">Message</Label>
        <p className="p-3 bg-muted rounded-lg text-sm">{submission.message}</p>
      </div>
      <div>
        <Label className="text-muted-foreground">Submitted</Label>
        <p className="font-medium">{format(new Date(submission.created_at), "PPpp")}</p>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Internal Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this submission..."
        />
      </div>
      <Button className="w-full" onClick={() => onUpdate(status, notes)} disabled={isPending}>
        {isPending ? "Saving..." : "Update Submission"}
      </Button>
    </div>
  );
};

export default HomepageAdmin;
