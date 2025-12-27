import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, MapPin, Users, Route, Loader2, CheckCircle2, Lightbulb } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface RouteSuggestion {
  name: string;
  students: {
    id: string;
    student_name: string;
    parent_name: string;
    pickup_order: number;
    lat: number;
    lng: number;
  }[];
  estimatedDistance: number;
  studentCount: number;
}

const AIRoutes: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedCarType, setSelectedCarType] = useState<string>('ac');
  const [maxSeats, setMaxSeats] = useState<string>('12');
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [aiInsights, setAiInsights] = useState<string>('');

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

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['supervisors-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supervisors')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-route-planner', {
        body: {
          action: 'suggest-routes',
          schoolId: selectedSchool,
          carType: selectedCarType,
          maxSeatsPerRoute: parseInt(maxSeats),
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      setAiInsights(data.aiInsights || '');
      if (data.suggestions?.length === 0) {
        toast({ title: 'No unassigned students found for this school and car type' });
      } else {
        toast({ title: `Found ${data.totalStudents} students, grouped into ${data.suggestions.length} routes` });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: async ({ suggestion, driverId, supervisorId }: { 
      suggestion: RouteSuggestion; 
      driverId?: string;
      supervisorId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-route-planner', {
        body: {
          action: 'create-suggested-route',
          suggestion,
          schoolId: selectedSchool,
          carType: selectedCarType,
          driverId,
          supervisorId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Route created successfully!' });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      // Remove created route from suggestions
      suggestMutation.mutate();
    },
    onError: (error: any) => {
      toast({ title: 'Error creating route', description: error.message, variant: 'destructive' });
    },
  });

  const handleSuggest = () => {
    if (!selectedSchool) {
      toast({ title: 'Please select a school', variant: 'destructive' });
      return;
    }
    setSuggestions([]);
    setAiInsights('');
    suggestMutation.mutate();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Route Planner
          </h1>
          <p className="text-muted-foreground mt-1">
            Automatically group students and optimize pickup routes using AI
          </p>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Route Configuration</CardTitle>
            <CardDescription>Select school and preferences to generate route suggestions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>School *</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
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
                <Label>Car Type</Label>
                <Select value={selectedCarType} onValueChange={setSelectedCarType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="ac">AC</SelectItem>
                    <SelectItem value="non_ac">Non-AC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Seats per Route</Label>
                <Input
                  type="number"
                  value={maxSeats}
                  onChange={(e) => setMaxSeats(e.target.value)}
                  min="4"
                  max="50"
                />
              </div>

              <div className="flex items-end">
                <Button onClick={handleSuggest} disabled={suggestMutation.isPending} className="w-full">
                  {suggestMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Suggestions
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        {aiInsights && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiInsights}</p>
            </CardContent>
          </Card>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Suggested Routes ({suggestions.length})</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((suggestion, idx) => (
                <Card key={idx} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {suggestion.studentCount}
                      </Badge>
                    </div>
                    <CardDescription>
                      <Route className="h-3 w-3 inline mr-1" />
                      Est. {suggestion.estimatedDistance} km
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {suggestion.students.map((student, sIdx) => (
                        <div key={student.id} className="flex items-center gap-2 text-sm">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                            {student.pickup_order}
                          </span>
                          <span className="truncate">{student.student_name || student.parent_name}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => createRouteMutation.mutate({ suggestion })}
                      disabled={createRouteMutation.isPending}
                    >
                      {createRouteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Create Route
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!suggestMutation.isPending && suggestions.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Route Suggestions Yet</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Select a school and click "Generate Suggestions" to let AI analyze student locations and create optimized routes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AIRoutes;
