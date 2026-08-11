import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, School as SchoolIcon, Plus, Check } from 'lucide-react';
import LocationPickerMap from '@/components/schools/LocationPickerMap';

export interface ConvertSelection {
  schoolId?: string;
  schoolName: string;
  newSchool?: {
    name: string;
    city: string;
    latitude: number;
    longitude: number;
  };
}

interface SchoolRow {
  id: string;
  name: string;
  city: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: {
    student_name: string;
    school_name: string;
    school_address: string | null;
    school_latitude: number | null;
    school_longitude: number | null;
    pickup_latitude: number;
    pickup_longitude: number;
    city: string;
  } | null;
  isSubmitting?: boolean;
  onConfirm: (selection: ConvertSelection) => void;
}

const ConvertToRegistrationDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  record,
  isSubmitting,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [showAllCities, setShowAllCities] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools-for-convert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, city')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as SchoolRow[];
    },
    enabled: open,
  });

  // Reset state whenever a new record is opened
  React.useEffect(() => {
    if (open && record) {
      setMode('existing');
      setSearch('');
      setShowAllCities(false);
      setSelectedId(null);
      setNewName(record.school_name || '');
      setNewCity(record.city || '');
      setNewLat(record.school_latitude ?? record.pickup_latitude);
      setNewLng(record.school_longitude ?? record.pickup_longitude);
    }
  }, [open, record]);

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter((s) => {
      const cityOk =
        showAllCities ||
        !record?.city ||
        (s.city || '').toLowerCase().includes(record.city.toLowerCase()) ||
        record.city.toLowerCase().includes((s.city || '').toLowerCase());
      const searchOk = !q || s.name.toLowerCase().includes(q);
      return cityOk && searchOk;
    });
  }, [schools, search, showAllCities, record]);

  const canConfirm =
    mode === 'existing'
      ? !!selectedId
      : newName.trim().length > 0 && newCity.trim().length > 0 && newLat !== null && newLng !== null;

  const handleConfirm = () => {
    if (!canConfirm) return;
    if (mode === 'existing') {
      const school = schools.find((s) => s.id === selectedId);
      onConfirm({ schoolId: selectedId!, schoolName: school?.name || '' });
    } else {
      onConfirm({
        schoolName: newName.trim(),
        newSchool: {
          name: newName.trim(),
          city: newCity.trim(),
          latitude: newLat!,
          longitude: newLng!,
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move to main registrations</DialogTitle>
        </DialogHeader>

        {record && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
              <p className="font-medium">{record.student_name}</p>
              <p className="text-muted-foreground">
                Parent wrote: <span className="text-foreground">{record.school_name}</span>
              </p>
              {record.school_address && (
                <p className="text-xs text-muted-foreground">{record.school_address}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('existing')}
              >
                <SchoolIcon className="h-4 w-4 mr-2" />
                Choose existing school
              </Button>
              <Button
                type="button"
                variant={mode === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('new')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create new school
              </Button>
            </div>

            {mode === 'existing' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search schools..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showAllCities}
                    onChange={(e) => setShowAllCities(e.target.checked)}
                  />
                  Show schools from all cities
                </label>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading schools...</p>}
                  {!isLoading && filteredSchools.length === 0 && (
                    <p className="p-3 text-sm text-muted-foreground">No matching schools.</p>
                  )}
                  {filteredSchools.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-muted/50 ${
                        selectedId === s.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <span>
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.city && <span className="block text-xs text-muted-foreground">{s.city}</span>}
                      </span>
                      {selectedId === s.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>School name *</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>City *</Label>
                  <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>School location *</Label>
                  <LocationPickerMap
                    initialLat={newLat ?? undefined}
                    initialLng={newLng ?? undefined}
                    onLocationChange={(lat, lng) => {
                      setNewLat(lat);
                      setNewLng(lng);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || isSubmitting}>
            {isSubmitting ? 'Moving...' : 'Move to registrations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertToRegistrationDialog;
