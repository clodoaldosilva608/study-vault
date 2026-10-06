import { formatDistanceToNow, format } from 'date-fns';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${sizes[i]}`;
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return format(d, 'MMM d, yyyy');
}

export function formatRelative(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function fileKind(mime: string, ext: string): 'image' | 'video' | 'audio' | 'pdf' | 'markdown' | 'text' | 'archive' | 'doc' | 'other' {
  const e = ext.toLowerCase().replace(/^\./, '');
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(e)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(e)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg', 'flac'].includes(e)) return 'audio';
  if (e === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (['md', 'markdown'].includes(e)) return 'markdown';
  if (mime.startsWith('text/') || ['txt', 'csv', 'json', 'yaml', 'yml'].includes(e)) return 'text';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive';
  if (['doc', 'docx', 'odt'].includes(e)) return 'doc';
  return 'other';
}
