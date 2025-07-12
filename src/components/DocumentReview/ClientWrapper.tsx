'use client';
import dynamic from 'next/dynamic';

const DocumentReview = dynamic(() => import('./DocumentReview'), { ssr: false });

export default function DocumentReviewClientWrapper() {
  return <DocumentReview />;
} 