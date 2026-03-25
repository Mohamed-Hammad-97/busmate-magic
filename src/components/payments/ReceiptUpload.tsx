import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Loader2, Image as ImageIcon, Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ReceiptUploadProps {
  paymentId: string;
  receiptUrl: string | null;
  canEdit?: boolean;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({ paymentId, receiptUrl, canEdit = true }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop();
      const filePath = `receipts/${paymentId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase
        .from('payments')
        .update({ receipt_url: filePath } as any)
        .eq('id', paymentId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('تم رفع إيصال الدفع بنجاح');
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast.error('حدث خطأ أثناء رفع الإيصال');
    },
  });

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الملف يجب أن يكون أقل من 5 ميجابايت');
      return;
    }
    uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const viewReceipt = async () => {
    if (!receiptUrl) return;
    const { data } = await supabase.storage
      .from('payment-receipts')
      .createSignedUrl(receiptUrl, 3600);
    if (data?.signedUrl) {
      setSignedUrl(data.signedUrl);
      setPreviewOpen(true);
    } else {
      toast.error('تعذر عرض الإيصال');
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      
      {receiptUrl ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg hover:bg-info/10 hover:text-info"
          onClick={viewReceipt}
          title="عرض إيصال الدفع"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      ) : canEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg hover:bg-accent/50 hover:text-accent-foreground"
          onClick={handleUpload}
          disabled={uploadMutation.isPending}
          title="رفع إيصال الدفع"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
        </Button>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إيصال الدفع</DialogTitle>
          </DialogHeader>
          {signedUrl && (
            <div className="rounded-lg overflow-hidden border">
              <img src={signedUrl} alt="Payment receipt" className="w-full h-auto" />
            </div>
          )}
          {canEdit && (
            <Button variant="outline" className="gap-2" onClick={handleUpload}>
              <Upload className="h-4 w-4" />
              تغيير الإيصال
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
