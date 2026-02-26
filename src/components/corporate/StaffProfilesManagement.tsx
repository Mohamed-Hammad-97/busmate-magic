import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  User, Edit, Upload, FileText, CreditCard, Eye, Loader2,
} from 'lucide-react';

interface StaffProfilesManagementProps {
  canEdit: boolean;
  staffContext?: 'school' | 'corporate';
}

export function StaffProfilesManagement({ canEdit, staffContext }: StaffProfilesManagementProps) {
  const queryClient = useQueryClient();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [personType, setPersonType] = useState<'driver' | 'supervisor'>('driver');
  const [profileForm, setProfileForm] = useState({
    bank_account_name: '',
    bank_name: '',
    bank_account_number: '',
    bank_iban: '',
  });
  const [uploading, setUploading] = useState(false);

  const { data: drivers = [] } = useQuery({
    queryKey: ['staff-profiles-drivers', staffContext],
    queryFn: async () => {
      let query = supabase.from('drivers').select('id, full_name, phone, belongs_to').order('full_name');
      if (staffContext) query = query.in('belongs_to', [staffContext, 'both']);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['staff-profiles-supervisors', staffContext],
    queryFn: async () => {
      let query = supabase.from('supervisors').select('id, full_name, phone, belongs_to').order('full_name');
      if (staffContext) query = query.in('belongs_to', [staffContext, 'both']);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_profiles').select('*');
      if (error) throw error;
      return data;
    },
  });

  const getProfile = (personId: string, type: 'driver' | 'supervisor') => {
    return profiles.find((p: any) => type === 'driver' ? p.driver_id === personId : p.supervisor_id === personId);
  };

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const existing = getProfile(selectedPerson.id, personType);
      const payload = {
        ...profileForm,
        [personType === 'driver' ? 'driver_id' : 'supervisor_id']: selectedPerson.id,
      };

      if (existing) {
        const { error } = await supabase.from('staff_profiles').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff_profiles').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
      toast.success('تم حفظ البيانات');
      setProfileDialogOpen(false);
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const handleOpenProfile = (person: any, type: 'driver' | 'supervisor') => {
    setSelectedPerson(person);
    setPersonType(type);
    const profile = getProfile(person.id, type);
    setProfileForm({
      bank_account_name: profile?.bank_account_name || '',
      bank_name: profile?.bank_name || '',
      bank_account_number: profile?.bank_account_number || '',
      bank_iban: profile?.bank_iban || '',
    });
    setProfileDialogOpen(true);
  };

  const handleFileUpload = async (file: File, fieldName: string) => {
    if (!selectedPerson) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${personType}/${selectedPerson.id}/${fieldName}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('staff-documents').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('staff-documents').getPublicUrl(path);

      const existing = getProfile(selectedPerson.id, personType);
      const update: any = { [`${fieldName}_url`]: publicUrl };
      if (existing) {
        await supabase.from('staff_profiles').update(update).eq('id', existing.id);
      } else {
        await supabase.from('staff_profiles').insert({
          ...update,
          [personType === 'driver' ? 'driver_id' : 'supervisor_id']: selectedPerson.id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
      toast.success('تم رفع الملف');
    } catch (err) {
      toast.error('خطأ في رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const allStaff = [
    ...drivers.map((d: any) => ({ ...d, type: 'driver' as const })),
    ...supervisors.map((s: any) => ({ ...s, type: 'supervisor' as const })),
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10"><User className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">ملفات السائقين والمشرفين</h2>
            <p className="text-xs text-muted-foreground">{allStaff.length} شخص</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الاسم</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">النوع</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">الهاتف</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">البنك</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">المستندات</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allStaff.map((person) => {
                const profile = getProfile(person.id, person.type);
                const hasBank = !!profile?.bank_account_number;
                const docCount = [profile?.id_document_url, profile?.license_document_url, profile?.contract_document_url].filter(Boolean).length;
                return (
                  <TableRow key={`${person.type}-${person.id}`} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {person.full_name[0]}
                        </div>
                        <span className="font-medium text-sm">{person.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={person.type === 'driver' ? 'outline' : 'secondary'} className="text-xs">
                        {person.type === 'driver' ? 'سائق' : 'مشرف'}
                      </Badge>
                    </TableCell>
                    <TableCell dir="ltr" className="text-sm text-muted-foreground text-right">{person.phone}</TableCell>
                    <TableCell>
                      {hasBank ? (
                        <div className="inline-flex items-center gap-1 text-xs text-success">
                          <CreditCard className="h-3 w-3" /> مسجل
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">غير مسجل</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{docCount}/3</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleOpenProfile(person, person.type)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ملف {selectedPerson?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Bank Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> بيانات الحساب البنكي</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">اسم صاحب الحساب</Label>
                  <Input value={profileForm.bank_account_name} onChange={(e) => setProfileForm({ ...profileForm, bank_account_name: e.target.value })} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">اسم البنك</Label>
                  <Input value={profileForm.bank_name} onChange={(e) => setProfileForm({ ...profileForm, bank_name: e.target.value })} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">رقم الحساب</Label>
                  <Input value={profileForm.bank_account_number} onChange={(e) => setProfileForm({ ...profileForm, bank_account_number: e.target.value })} dir="ltr" disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">IBAN</Label>
                  <Input value={profileForm.bank_iban} onChange={(e) => setProfileForm({ ...profileForm, bank_iban: e.target.value })} dir="ltr" disabled={!canEdit} />
                </div>
              </div>
              {canEdit && (
                <Button size="sm" onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
                  {saveProfileMutation.isPending ? 'جاري الحفظ...' : 'حفظ البيانات البنكية'}
                </Button>
              )}
            </div>

            {/* Document Uploads */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> المستندات</h3>
              {[
                { key: 'id_document', label: 'البطاقة الشخصية' },
                { key: 'license_document', label: 'رخصة القيادة' },
                { key: 'contract_document', label: 'العقد' },
              ].map(doc => {
                const profile = selectedPerson ? getProfile(selectedPerson.id, personType) : null;
                const url = profile?.[`${doc.key}_url` as keyof typeof profile] as string | undefined;
                return (
                  <div key={doc.key} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{doc.label}</span>
                      {url && <Badge variant="outline" className="text-xs text-success">مرفوع</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a>
                        </Button>
                      )}
                      {canEdit && (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, doc.key);
                            }}
                          />
                          <div className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/5">
                            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            رفع
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
