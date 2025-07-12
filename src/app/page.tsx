'use client';
import { useState } from 'react';
import OCRChatUploaderClientWrapper from '@/components/OCRChatUploader/ClientWrapper';
import DocumentReviewClientWrapper from '@/components/DocumentReview/ClientWrapper';
import { Button } from '@/components/ui/button';
import { FileText, MessageSquare } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'ocr' | 'review'>('ocr');

  return (
    <div className="min-h-screen bg-background px-2 py-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Document Assistant</h1>
          <p className="text-gray-600">Upload documents and get instant insights</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-6">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              variant={activeTab === 'ocr' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('ocr')}
              className="flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              OCR Chat
            </Button>
            <Button
              variant={activeTab === 'review' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('review')}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Document Review
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex justify-center">
          {activeTab === 'ocr' ? (
            <OCRChatUploaderClientWrapper />
          ) : (
            <DocumentReviewClientWrapper />
          )}
        </div>
      </div>
    </div>
  );
}
