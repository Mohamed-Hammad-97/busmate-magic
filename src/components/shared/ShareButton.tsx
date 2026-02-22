import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, MessageCircle, Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ url, title = '', text = '' }) => {
  const { t } = useTranslation();
  
  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`${title}\n${text}\n${url}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };
  
  const shareViaEmail = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${text}\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(url);
    toast.success(t('common.copied'));
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur-sm">
          <Share2 className="h-4 w-4" />
          {t('common.shareVia')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={shareViaWhatsApp} className="gap-2 cursor-pointer">
          <MessageCircle className="h-4 w-4 text-green-500" />
          {t('common.whatsapp')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareViaEmail} className="gap-2 cursor-pointer">
          <Mail className="h-4 w-4 text-blue-500" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyToClipboard} className="gap-2 cursor-pointer">
          <Copy className="h-4 w-4" />
          {t('common.copyLink')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
