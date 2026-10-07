'use client';

import {
  SimpleDialog,
  SimpleDialogHeader,
  SimpleDialogTitle,
  SimpleDialogBody,
  SimpleDialogClose,
} from '@/components/common/simple-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Copy,
  Check,
  Mail,
  Facebook,
  Twitter,
  Linkedin,
  Telegram,
  Reddit,
  ExternalLink,
  MessageCircle,
  Bookmark,
} from 'lucide-react';
import { useState } from 'react';
import { simpleToast as toast } from '@/components/common/simple-toast';

type ShareOption = {
  name: string;
  icon: React.ElementType;
  color: string;
  getUrl: (url: string, text: string) => string;
};

const SHARE_OPTIONS: ShareOption[] = [
  {
    name: 'WhatsApp',
    icon: MessageCircle,
    color: 'text-emerald-500',
    getUrl: (url, text) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
  },
  {
    name: 'Telegram',
    icon: Telegram,
    color: 'text-blue-500',
    getUrl: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    name: 'Email',
    icon: Mail,
    color: 'text-muted-foreground',
    getUrl: (url, text) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent('Veja este arquivo: ' + url)}`,
  },
  {
    name: 'Twitter / X',
    icon: Twitter,
    color: 'text-sky-500',
    getUrl: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    getUrl: (url, text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-700',
    getUrl: (url, text) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'Reddit',
    icon: Reddit,
    color: 'text-orange-500',
    getUrl: (url, text) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    name: 'Pinterest',
    icon: Bookmark,
    color: 'text-red-600',
    getUrl: (url, text) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}`,
  },
];

export function ShareDialog({
  open,
  onOpenChange,
  fileName,
  fileId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fileName: string;
  fileId: string;
}) {
  const [copied, setCopied] = useState(false);

  // The share URL points to the app with the file ID
  // In a production app this would be a public share link
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://study-vault-six-delta.vercel.app'}/?file=${fileId}`;
  const shareText = `Confira "${fileName}" no Study Vault`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Falha ao copiar');
    }
  };

  const handleShare = (option: ShareOption) => {
    const url = option.getUrl(shareUrl, shareText);
    window.open(url, '_blank', 'width=600,height=600');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: fileName,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <SimpleDialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <SimpleDialogClose onClose={() => onOpenChange(false)} />
      <SimpleDialogHeader>
        <SimpleDialogTitle>Compartilhar</SimpleDialogTitle>
      </SimpleDialogHeader>
      <SimpleDialogBody>
        <div className="space-y-4">
          {/* File name */}
          <div className="text-sm text-muted-foreground truncate">
            {fileName}
          </div>

          {/* Copy link */}
          <div className="flex items-center gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="text-xs font-mono"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              size="sm"
              variant={copied ? 'default' : 'outline'}
              onClick={handleCopy}
              className="gap-1.5 shrink-0"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>

          {/* Native share button (mobile) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              onClick={handleNativeShare}
              className="w-full gap-2"
              size="sm"
            >
              <ExternalLink className="h-4 w-4" />
              Compartilhar via...
            </Button>
          )}

          {/* Social media grid */}
          <div className="grid grid-cols-4 gap-3">
            {SHARE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.name}
                  onClick={() => handleShare(option)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:bg-accent/40 hover:border-border/80 transition-colors group"
                >
                  <Icon className={`h-6 w-6 ${option.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {option.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-border pt-3">
            <p className="text-[11px] text-muted-foreground text-center">
              O link permite que qualquer pessoa com acesso visualize o arquivo
            </p>
          </div>
        </div>
      </SimpleDialogBody>
    </SimpleDialog>
  );
}
