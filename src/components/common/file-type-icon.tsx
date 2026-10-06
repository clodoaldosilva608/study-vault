'use client';

import {
  File as FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileType,
  FileSpreadsheet,
} from 'lucide-react';
import { fileKind } from '@/lib/utils/file';
import { cn } from '@/lib/utils';

export function FileTypeIcon({
  mimeType,
  extension,
  className,
}: {
  mimeType: string;
  extension: string;
  className?: string;
}) {
  const kind = fileKind(mimeType, extension);
  const map = {
    image: FileImage,
    video: FileVideo,
    audio: FileAudio,
    pdf: FileText,
    markdown: FileType,
    text: FileText,
    archive: FileArchive,
    doc: FileText,
    other: FileIcon,
  } as const;
  const Icon = map[kind];
  const color = {
    image: 'text-sky-500',
    video: 'text-rose-500',
    audio: 'text-amber-500',
    pdf: 'text-red-500',
    markdown: 'text-emerald-500',
    text: 'text-muted-foreground',
    archive: 'text-orange-500',
    doc: 'text-blue-500',
    other: 'text-muted-foreground',
  }[kind];
  return <Icon className={cn('h-4.5 w-4.5', color, className)} />;
}
