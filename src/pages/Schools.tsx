import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, MapPin, School as SchoolIcon, Loader2 } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface School {
  id: string;
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SchoolFormData {
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

const MAPBOX_TOKEN = "pk.eyJ1IjoiYWhtZWRoYW1hYWQiLCJhIjoiY21qbW5pd3FnMDJqZzNlc2s4d2kwempvNiJ9.epSJQYdtc-gBr7HZq02JDw";

export default function Schools() {
  const { hasDepartment } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<SchoolFormData>({
    name: "",
    city: "",
    latitude: 30.0444,
    longitude: 31.2357,
    is_active: true,
  });

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const dialogMapContainer = useRef<HTMLDivElement>(null);
  const dialogMap = useRef<mapboxgl.Map | null>(null);
  const dialogMarker = useRef<mapboxgl.Marker | null>(null);

  const canManage = hasDepartment("operations");

  const fetchSchools = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("name");

      if (error) throw error;
      setSchools(data || []);
    } catch (error: any) {
      console.error("Error fetching schools:", error);
      toast.error("Failed to load schools");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  // Initialize main map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [31.2357, 30.0444], // Cairo, Egypt
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      markers.current.forEach((m) => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when schools change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    // Add new markers
    schools.forEach((school) => {
      const el = document.createElement("div");
      el.className = "school-marker";
      el.innerHTML = `
        <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
          school.is_active ? "bg-primary" : "bg-muted"
        }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m4 6 8-4 8 4"/>
            <path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/>
            <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/>
            <path d="M18 5v17"/>
            <path d="M6 5v17"/>
            <circle cx="12" cy="9" r="2"/>
          </svg>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <h3 class="font-semibold">${school.name}</h3>
          <p class="text-sm text-muted-foreground">${school.city || "No city"}</p>
          <span class="text-xs ${school.is_active ? "text-green-600" : "text-red-600"}">
            ${school.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([school.longitude, school.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });

    // Fit bounds if there are schools
    if (schools.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      schools.forEach((school) => {
        bounds.extend([school.longitude, school.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    }
  }, [schools]);

  // Initialize dialog map when dialog opens
  useEffect(() => {
    if (!isDialogOpen || !dialogMapContainer.current) return;

    // Small delay to ensure dialog is rendered
    const timeout = setTimeout(() => {
      if (dialogMap.current) {
        dialogMap.current.remove();
      }

      mapboxgl.accessToken = MAPBOX_TOKEN;

      dialogMap.current = new mapboxgl.Map({
        container: dialogMapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [formData.longitude, formData.latitude],
        zoom: 12,
      });

      dialogMap.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Add marker
      dialogMarker.current = new mapboxgl.Marker({ draggable: true })
        .setLngLat([formData.longitude, formData.latitude])
        .addTo(dialogMap.current);

      // Update form on marker drag
      dialogMarker.current.on("dragend", () => {
        const lngLat = dialogMarker.current!.getLngLat();
        setFormData((prev) => ({
          ...prev,
          latitude: lngLat.lat,
          longitude: lngLat.lng,
        }));
      });

      // Add click to move marker
      dialogMap.current.on("click", (e) => {
        dialogMarker.current?.setLngLat(e.lngLat);
        setFormData((prev) => ({
          ...prev,
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng,
        }));
      });
    }, 100);

    return () => {
      clearTimeout(timeout);
    };
  }, [isDialogOpen, formData.latitude, formData.longitude]);

  const handleOpenDialog = (school?: School) => {
    if (school) {
      setEditingSchool(school);
      setFormData({
        name: school.name,
        city: school.city || "",
        latitude: school.latitude,
        longitude: school.longitude,
        is_active: school.is_active,
      });
    } else {
      setEditingSchool(null);
      setFormData({
        name: "",
        city: "",
        latitude: 30.0444,
        longitude: 31.2357,
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("School name is required");
      return;
    }

    setIsSaving(true);

    try {
      if (editingSchool) {
        const { error } = await supabase
          .from("schools")
          .update({
            name: formData.name.trim(),
            city: formData.city.trim() || null,
            latitude: formData.latitude,
            longitude: formData.longitude,
            is_active: formData.is_active,
          })
          .eq("id", editingSchool.id);

        if (error) throw error;
        toast.success("School updated successfully");
      } else {
        const { error } = await supabase.from("schools").insert({
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success("School added successfully");
      }

      setIsDialogOpen(false);
      fetchSchools();
    } catch (error: any) {
      console.error("Error saving school:", error);
      toast.error(error.message || "Failed to save school");
    } finally {
      setIsSaving(false);
    }
  };

  const focusOnSchool = (school: School) => {
    if (map.current) {
      map.current.flyTo({
        center: [school.longitude, school.latitude],
        zoom: 14,
        duration: 1500,
      });
    }
  };

  return (
    <DashboardLayout title="Schools" description="Manage schools and their locations">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                School Locations
              </h3>
            </div>
            <div ref={mapContainer} className="h-[500px]" />
          </div>
        </div>

        {/* Table Section */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          <div className="bg-card rounded-xl border">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <SchoolIcon className="h-5 w-5 text-primary" />
                Schools List
              </h3>
              {canManage && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => handleOpenDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add School
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingSchool ? "Edit School" : "Add New School"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">School Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            placeholder="Enter school name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) =>
                              setFormData({ ...formData, city: e.target.value })
                            }
                            placeholder="Enter city"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Location (Click on map or drag marker)</Label>
                        <div
                          ref={dialogMapContainer}
                          className="h-[250px] rounded-lg border overflow-hidden"
                        />
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              Latitude
                            </Label>
                            <Input
                              type="number"
                              step="any"
                              value={formData.latitude}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  latitude: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              Longitude
                            </Label>
                            <Input
                              type="number"
                              step="any"
                              value={formData.longitude}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  longitude: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, is_active: checked })
                          }
                        />
                        <Label htmlFor="is_active">Active</Label>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                          {isSaving && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          {editingSchool ? "Update" : "Add"} School
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="max-h-[440px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : schools.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <SchoolIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No schools found</p>
                  {canManage && (
                    <p className="text-sm mt-1">Click "Add School" to create one</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schools.map((school) => (
                      <TableRow key={school.id}>
                        <TableCell className="font-medium">{school.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {school.city || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={school.is_active ? "default" : "secondary"}
                          >
                            {school.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => focusOnSchool(school)}
                              title="Show on map"
                            >
                              <MapPin className="h-4 w-4" />
                            </Button>
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(school)}
                                title="Edit school"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
