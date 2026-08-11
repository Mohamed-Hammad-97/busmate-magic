import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HelpCircle, Eye, ArrowRightCircle, Search, MapPin, Trash2, CheckCircle } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type OtherRegistration = Tables<'other_registrations'>;

interface Props {
  canManage: boolean;
  canDelete: boolean;
  cityNames: string[];
}

const OtherRegistrations: React.FC<Props> = ({ canManage, canDelete, cityNames }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OtherRegistration | null>(null);
  const [convertTarget, setConvertTarget] = useState<OtherRegistration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OtherRegistration | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['other-registrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('other_registrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OtherRegistration[];
    },
  });

  const cityFiltered = cityNames.length === 0
    ? records
    : records.filter((r) => cityNames.some((n) => (r.city || '').toLowerCase().includes(n.toLowerCase())));

  const filtered = cityFiltered.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.student_name, r.parent_name, r.school_name, r.father_phone, r.mother_phone]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  const pendingCount = cityFiltered.filter((r) => r.status === 'pending').length;

  const convertMutation = useMutation({
    mutationFn: async ({ rec, selection }: { rec: OtherRegistration; selection: ConvertSelection }) => {
      // 1. Resolve the school chosen by the employee
      let schoolId: string | null = selection.schoolId ?? null;
      if (!schoolId && selection.newSchool) {
        const { data: newSchool, error: schoolError } = await supabase
          .from('schools')
          .insert({
            name: selection.newSchool.name,
            city: selection.newSchool.city,
            latitude: selection.newSchool.latitude,
            longitude: selection.newSchool.longitude,
            is_active: true,
          })
          .select('id')
          .single();
        if (schoolError) throw schoolError;
        schoolId = newSchool.id;
      }
      if (!schoolId) throw new Error('No school selected');


      // 2. Find or create the parent account
      let parentId: string | null = null;
      const { data: existingParent } = await supabase
        .from('parent_accounts')
        .select('id')
        .eq('father_phone', rec.father_phone)
        .maybeSingle();

      if (existingParent) {
        parentId = existingParent.id;
      } else {
        const { data: newParent, error: parentError } = await supabase
          .from('parent_accounts')
          .insert({
            parent_name: rec.parent_name,
            national_id: rec.national_id || '0',
            father_phone: rec.father_phone,
            mother_phone: rec.mother_phone,
            emergency_phone: rec.emergency_phone,
            payment_phone: rec.payment_phone,
            job: rec.job,
            city: rec.city,
            pickup_latitude: rec.pickup_latitude,
            pickup_longitude: rec.pickup_longitude,
            pickup_address: rec.pickup_address,
          })
          .select('id')
          .single();
        if (parentError) throw parentError;
        parentId = newParent.id;
      }

      // 3. Create the registration
      const { data: newReg, error: regError } = await supabase
        .from('registrations')
        .insert({
          parent_id: parentId,
          school_id: schoolId,
          student_name: rec.student_name,
          grade: rec.grade,
          car_type: rec.car_type,
          education_department: rec.education_department,
          comments: rec.comments,
          status: 'pending_fees',
        })
        .select('id')
        .single();
      if (regError) throw regError;

      // 4. Mark the other-registration as converted
      const { data: userData } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('other_registrations')
        .update({
          status: 'converted',
          converted_registration_id: newReg.id,
          processed_by: userData?.user?.id ?? null,
          processed_at: new Date().toISOString(),
          school_name: selection.schoolName || rec.school_name,
          school_address: null,
          school_latitude: null,
          school_longitude: null,
        })
        .eq('id', rec.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['other-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      toast({ title: 'Moved to registrations', description: 'The record now appears in the main registrations tab.' });
      setConvertTarget(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to convert record', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (rec: OtherRegistration) => {
      const { error } = await supabase.from('other_registrations').delete().eq('id', rec.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['other-registrations'] });
      toast({ title: 'Record deleted' });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by student, parent, school or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 rounded-xl"
        />
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-warning/10">
            <HelpCircle className="h-4 w-4 text-warning" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Other Registrations</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} records · {pendingCount} pending review
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
              <HelpCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No other registrations</p>
            <p className="text-xs text-muted-foreground">Submissions where the parent's school isn't listed will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead>Student</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>School (typed)</TableHead>
                  <TableHead>Pickup Address</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rec) => (
                  <TableRow key={rec.id} className="border-border/50">
                    <TableCell className="font-medium">{rec.student_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">{rec.parent_name}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{rec.father_phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{rec.school_name}</div>
                      {rec.school_address && (
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{rec.school_address}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] text-xs text-muted-foreground line-clamp-2">{rec.pickup_address}</TableCell>
                    <TableCell className="text-sm">{rec.grade}</TableCell>
                    <TableCell>
                      {rec.status === 'converted' ? (
                        <Badge className="bg-success/10 text-success border-success/20 gap-1">
                          <CheckCircle className="h-3 w-3" /> Converted
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(rec.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelected(rec)} title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canManage && rec.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConvertTarget(rec)}
                            title="Move to registrations"
                          >
                            <ArrowRightCircle className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(rec)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Details dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.student_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <Field label="Parent" value={selected.parent_name} />
              <Field label="National ID" value={selected.national_id} />
              <Field label="Father Phone" value={selected.father_phone} />
              <Field label="Mother Phone" value={selected.mother_phone} />
              <Field label="Emergency Phone" value={selected.emergency_phone} />
              <Field label="Payment Phone" value={selected.payment_phone} />
              <Field label="Job" value={selected.job} />
              <Field label="City" value={selected.city} />
              <Field label="School Name" value={selected.school_name} />
              <Field label="School Address" value={selected.school_address} />
              <Field label="Grade" value={selected.grade} />
              <Field label="Education Dept." value={selected.education_department} />
              <Field label="Car Type" value={selected.car_type} />
              <div className="sm:col-span-2">
                <Field label="Pickup Address" value={selected.pickup_address} />
              </div>
              {selected.comments && (
                <div className="sm:col-span-2">
                  <Field label="Comments" value={selected.comments} />
                </div>
              )}
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps?q=${selected.pickup_latitude},${selected.pickup_longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-2">
                    <MapPin className="h-4 w-4" /> Pickup location
                  </Button>
                </a>
                {selected.school_latitude && selected.school_longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${selected.school_latitude},${selected.school_longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <MapPin className="h-4 w-4" /> School location
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert: choose school first */}
      <ConvertToRegistrationDialog
        open={!!convertTarget}
        onOpenChange={(open) => !open && setConvertTarget(null)}
        record={convertTarget}
        isSubmitting={convertMutation.isPending}
        onConfirm={(selection) => convertTarget && convertMutation.mutate({ rec: convertTarget, selection })}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the submission for "{deleteTarget?.student_name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Field: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm text-foreground">{value || '—'}</p>
  </div>
);

export default OtherRegistrations;
