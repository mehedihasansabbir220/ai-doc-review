'use client';
import dynamic from 'next/dynamic';

const OCRChatUploader = dynamic(() => import('./OCRChatUploader'), { ssr: false });

export default function OCRChatUploaderClientWrapper() {
  return <OCRChatUploader />;
} 