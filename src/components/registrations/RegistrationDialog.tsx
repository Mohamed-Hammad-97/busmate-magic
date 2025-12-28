import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import LocationPickerMap from '@/components/schools/LocationPickerMap';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'> & {
  parent_accounts: Tables<'parent_accounts'>;
  schools: Tables<'schools'>;
};

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: Registration | null;
  onSuccess: () => void;
}

interface ParentFormData {
  parent_name: string;
  national_id: string;
  father_phone: string;
  mother_phone: string;
  emergency_phone: string;
  city: string;
  job: string;
  pickup_latitude: number;
  pickup_longitude: number;
}

interface RegistrationFormData {
  student_name: string;
  school_id: string;
  grade: string;
  car_type: Enums<'car_type'>;
  education_department: Enums<'education_department'>;
  status: Enums<'registration_status'>;
}

const gradeOptions = [
  'KG1', 'KG2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 
  'Grade 10', 'Grade 11', 'Grade 12'
];

const RegistrationDialog: React.FC<RegistrationDialogProps> = ({
  open,
  onOpenChange,
  registration,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isEditing = !!registration;

  const [parentData, setParentData] = useState<ParentFormData>({
    parent_name: '',
    national_id: '',
    father_phone: '',
    mother_phone: '',
    emergency_phone: '',
    city: '',
    job: '',
    pickup_latitude: 30.0444,
    pickup_longitude: 31.2357,
  });

  const [regData, setRegData] = useState<RegistrationFormData>({
    student_name: '',
    school_id: '',
    grade: '',
    car_type: 'ac',
    education_department: 'national',
    status: 'pending_fees',
  });

  // Fetch schools
  const { data: schools = [] } = useQuery({
    queryKey: ['schools-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
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

  // Populate form when editing
  useEffect(() => {
    if (registration) {
      setParentData({
        parent_name: registration.parent_accounts?.parent_name || '',
        national_id: registration.parent_accounts?.national_id || '',
        father_phone: registration.parent_accounts?.father_phone || '',
        mother_phone: registration.parent_accounts?.mother_phone || '',
        emergency_phone: registration.parent_accounts?.emergency_phone || '',
        city: registration.parent_accounts?.city || '',
        job: registration.parent_accounts?.job || '',
        pickup_latitude: registration.parent_accounts?.pickup_latitude || 30.0444,
        pickup_longitude: registration.parent_accounts?.pickup_longitude || 31.2357,
      });
      setRegData({
        student_name: registration.student_name || '',
        school_id: registration.school_id,
        grade: registration.grade,
        car_type: registration.car_type,
        education_department: registration.education_department,
        status: registration.status,
      });
    } else {
      resetForm();
    }
  }, [registration, open]);

  const resetForm = () => {
    setParentData({
      parent_name: '',
      national_id: '',
      father_phone: '',
      mother_phone: '',
      emergency_phone: '',
      city: '',
      job: '',
      pickup_latitude: 30.0444,
      pickup_longitude: 31.2357,
    });
    setRegData({
      student_name: '',
      school_id: '',
      grade: '',
      car_type: 'ac',
      education_department: 'national',
      status: 'pending_fees',
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEditing && registration) {
        // Update parent account
        const { error: parentError } = await supabase
          .from('parent_accounts')
          .update({
            parent_name: parentData.parent_name,
            national_id: parentData.national_id,
            father_phone: parentData.father_phone,
            mother_phone: parentData.mother_phone || null,
            emergency_phone: parentData.emergency_phone,
            city: parentData.city,
            job: parentData.job || null,
            pickup_latitude: parentData.pickup_latitude,
            pickup_longitude: parentData.pickup_longitude,
          })
          .eq('id', registration.parent_id);
        if (parentError) throw parentError;

        // Update registration
        const { error: regError } = await supabase
          .from('registrations')
          .update({
            student_name: regData.student_name,
            school_id: regData.school_id,
            grade: regData.grade,
            car_type: regData.car_type,
            education_department: regData.education_department,
            status: regData.status,
          })
          .eq('id', registration.id);
        if (regError) throw regError;
        if (regError) throw regError;
      } else {
        // Create new parent account
        const { data: newParent, error: parentError } = await supabase
          .from('parent_accounts')
          .insert({
            parent_name: parentData.parent_name,
            national_id: parentData.national_id,
            father_phone: parentData.father_phone,
            mother_phone: parentData.mother_phone || null,
            emergency_phone: parentData.emergency_phone,
            city: parentData.city,
            job: parentData.job || null,
            pickup_latitude: parentData.pickup_latitude,
            pickup_longitude: parentData.pickup_longitude,
          })
          .select()
          .single();
        if (parentError) throw parentError;

        // Create registration
        const { error: regError } = await supabase
          .from('registrations')
          .insert({
            parent_id: newParent.id,
            student_name: regData.student_name,
            school_id: regData.school_id,
            grade: regData.grade,
            car_type: regData.car_type,
            education_department: regData.education_department,
            status: regData.status,
            created_by: user?.id,
          });
        if (regError) throw regError;
        if (regError) throw regError;
      }
    },
    onSuccess: () => {
      toast({ title: isEditing ? 'Registration updated' : 'Registration created' });
      onSuccess();
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!regData.student_name.trim()) {
      toast({ title: 'Please enter student name', variant: 'destructive' });
      return;
    }
    if (!parentData.parent_name.trim()) {
      toast({ title: 'Please enter parent name', variant: 'destructive' });
      return;
    }
    if (!parentData.national_id.trim()) {
      toast({ title: 'Please enter national ID', variant: 'destructive' });
      return;
    }
    if (!parentData.father_phone.trim()) {
      toast({ title: 'Please enter father phone', variant: 'destructive' });
      return;
    }
    if (!parentData.emergency_phone.trim()) {
      toast({ title: 'Please enter emergency phone', variant: 'destructive' });
      return;
    }
    if (!parentData.city) {
      toast({ title: 'Please select city', variant: 'destructive' });
      return;
    }
    if (!regData.school_id) {
      toast({ title: 'Please select school', variant: 'destructive' });
      return;
    }
    if (!regData.grade) {
      toast({ title: 'Please select grade', variant: 'destructive' });
      return;
    }

    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Registration' : 'New Registration'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="parent" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="parent">Parent Info</TabsTrigger>
              <TabsTrigger value="location">Pickup Location</TabsTrigger>
              <TabsTrigger value="registration">Registration</TabsTrigger>
            </TabsList>

            <TabsContent value="parent" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Student Name *</Label>
                  <Input
                    value={regData.student_name}
                    onChange={(e) => setRegData((r) => ({ ...r, student_name: e.target.value }))}
                    placeholder="Full student name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parent Name *</Label>
                  <Input
                    value={parentData.parent_name}
                    onChange={(e) => setParentData((p) => ({ ...p, parent_name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>National ID *</Label>
                  <Input
                    value={parentData.national_id}
                    onChange={(e) => setParentData((p) => ({ ...p, national_id: e.target.value }))}
                    placeholder="14 digits"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Father Phone *</Label>
                  <Input
                    value={parentData.father_phone}
                    onChange={(e) => setParentData((p) => ({ ...p, father_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mother Phone</Label>
                  <Input
                    value={parentData.mother_phone}
                    onChange={(e) => setParentData((p) => ({ ...p, mother_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Phone *</Label>
                  <Input
                    value={parentData.emergency_phone}
                    onChange={(e) => setParentData((p) => ({ ...p, emergency_phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Job</Label>
                  <Input
                    value={parentData.job}
                    onChange={(e) => setParentData((p) => ({ ...p, job: e.target.value }))}
                    placeholder="Occupation"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>City *</Label>
                  <Select
                    value={parentData.city}
                    onValueChange={(v) => setParentData((p) => ({ ...p, city: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.name}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="location" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Pickup Location *</Label>
                <GoogleMapsProvider>
                  <LocationPickerMap
                    initialLat={parentData.pickup_latitude}
                    initialLng={parentData.pickup_longitude}
                    onLocationChange={(lat, lng) =>
                      setParentData((p) => ({ ...p, pickup_latitude: lat, pickup_longitude: lng }))
                    }
                  />
                </GoogleMapsProvider>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Lat: {parentData.pickup_latitude.toFixed(6)}</span>
                  <span>Lng: {parentData.pickup_longitude.toFixed(6)}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="registration" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>School *</Label>
                  <Select
                    value={regData.school_id}
                    onValueChange={(v) => setRegData((r) => ({ ...r, school_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grade *</Label>
                  <Select
                    value={regData.grade}
                    onValueChange={(v) => setRegData((r) => ({ ...r, grade: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {gradeOptions.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Education Department *</Label>
                  <Select
                    value={regData.education_department}
                    onValueChange={(v) => setRegData((r) => ({ ...r, education_department: v as Enums<'education_department'> }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="ig">IG</SelectItem>
                      <SelectItem value="american">American</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Car Type *</Label>
                  <Select
                    value={regData.car_type}
                    onValueChange={(v) => setRegData((r) => ({ ...r, car_type: v as Enums<'car_type'> }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="ac">AC</SelectItem>
                      <SelectItem value="non_ac">Non-AC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isEditing && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Status</Label>
                    <Select
                      value={regData.status}
                      onValueChange={(v) => setRegData((r) => ({ ...r, status: v as Enums<'registration_status'> }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="pending_fees">Pending Fees</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'} Registration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationDialog;
