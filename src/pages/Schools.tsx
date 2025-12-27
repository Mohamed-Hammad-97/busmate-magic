import React, { useState } from 'react';
import { Plus, MapPin, Edit2, School as SchoolIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import SchoolMap from '@/components/schools/SchoolMap';
import LocationPickerMap from '@/components/schools/LocationPickerMap';
import CitiesManagement from '@/components/schools/CitiesManagement';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import type { Tables } from '@/integrations/supabase/types';

type School = Tables<'schools'>;

interface SchoolFormData {
  id?: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

const Schools: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<SchoolFormData>({
    name: '',
    city: '',
    latitude: 30.0444,
    longitude: 31.2357,
    is_active: true,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token: mapboxToken, isLoading: tokenLoading } = useMapboxToken();

  // Fetch schools
  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as School[];
    },
  });

  // Fetch cities
  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Save school mutation
  const saveMutation = useMutation({
    mutationFn: async (data: SchoolFormData) => {
      if (data.id) {
        const { error } = await supabase
          .from('schools')
          .update({
            name: data.name,
            city: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
            is_active: data.is_active,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('schools').insert({
          name: data.name,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          is_active: data.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: formData.id ? 'School updated' : 'School added' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      city: '',
      latitude: 30.0444,
      longitude: 31.2357,
      is_active: true,
    });
  };

  const handleOpenDialog = (school?: School) => {
    if (school) {
      setFormData({
        id: school.id,
        name: school.name,
        city: school.city || '',
        latitude: school.latitude,
        longitude: school.longitude,
        is_active: school.is_active,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Please enter school name', variant: 'destructive' });
      return;
    }
    if (!formData.city) {
      toast({ title: 'Please select a city', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };

  return (
    <DashboardLayout title="Schools Management" description="Manage schools and their locations">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <CitiesManagement />
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add School
          </Button>
        </div>

        {/* Map Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Schools Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tokenLoading ? (
              <div className="h-[400px] flex items-center justify-center bg-muted rounded-lg">
                <p className="text-muted-foreground">Loading map...</p>
              </div>
            ) : mapboxToken ? (
              <SchoolMap
                schools={schools}
                mapboxToken={mapboxToken}
                onSchoolClick={(school) => handleOpenDialog(school)}
              />
            ) : (
              <div className="h-[400px] flex items-center justify-center bg-muted rounded-lg">
                <p className="text-muted-foreground">Mapbox token not configured</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schools Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SchoolIcon className="h-5 w-5" />
              All Schools ({schools.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schoolsLoading ? (
              <p className="text-muted-foreground">Loading schools...</p>
            ) : schools.length === 0 ? (
              <div className="text-center py-8">
                <SchoolIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No schools added yet</p>
                <Button className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First School
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell className="font-medium">{school.name}</TableCell>
                      <TableCell>{school.city || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {school.latitude.toFixed(4)}, {school.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={school.is_active ? 'default' : 'secondary'}>
                          {school.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(school)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{formData.id ? 'Edit School' : 'Add New School'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">School Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter school name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, city: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {cities.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No cities available. Please add cities first.
                        </div>
                      ) : (
                        cities.map((city) => (
                          <SelectItem key={city.id} value={city.name}>
                            {city.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Location *</Label>
                {mapboxToken ? (
                  <LocationPickerMap
                    mapboxToken={mapboxToken}
                    initialLat={formData.latitude}
                    initialLng={formData.longitude}
                    onLocationChange={handleLocationChange}
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center bg-muted rounded-lg">
                    <p className="text-muted-foreground">Map loading...</p>
                  </div>
                )}
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Lat: {formData.latitude.toFixed(6)}</span>
                  <span>Lng: {formData.longitude.toFixed(6)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : formData.id ? 'Update' : 'Add'} School
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Schools;
