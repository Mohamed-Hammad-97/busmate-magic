import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface City {
  id: string;
  name: string;
  is_active: boolean;
}

const CitiesManagement: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [newCity, setNewCity] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as City[];
    },
  });

  const addCityMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('cities').insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      setNewCity('');
      toast({ title: 'City added successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error adding city', description: error.message, variant: 'destructive' });
    },
  });

  const updateCityMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('cities').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      setEditingId(null);
      toast({ title: 'City updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error updating city', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCityMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      toast({ title: 'City deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error deleting city', description: error.message, variant: 'destructive' });
    },
  });

  const handleAddCity = () => {
    if (newCity.trim()) {
      addCityMutation.mutate(newCity.trim());
    }
  };

  const handleUpdateCity = (id: string) => {
    if (editingName.trim()) {
      updateCityMutation.mutate({ id, name: editingName.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm">
          <Edit2 className="h-4 w-4" />
          Manage Cities
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Cities</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new city..."
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCity()}
            />
            <Button onClick={handleAddCity} disabled={!newCity.trim() || addCityMutation.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : cities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cities added yet</p>
            ) : (
              cities.map((city) => (
                <div key={city.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  {editingId === city.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8"
                      />
                      <Button size="sm" variant="ghost" onClick={() => handleUpdateCity(city.id)}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium">{city.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(city.id);
                            setEditingName(city.name);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteCityMutation.mutate(city.id)}
                          disabled={deleteCityMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CitiesManagement;
