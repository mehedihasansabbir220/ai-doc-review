import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromFile } from '@/lib/pdfOcrUtils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files');
    const customPrompt = formData.get('prompt') as string;
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log('Processing', files.length, 'files');
    if (customPrompt) {
      console.log('Custom prompt:', customPrompt);
    }

    const results = await Promise.all(
      files.map(async (entry, index) => {
        if (!(entry instanceof File)) {
          return { filename: 'unknown', text: 'Invalid file entry' };
        }
        const file = entry;
        let text = '';
        try {
          console.log(`Processing file ${index + 1}/${files.length}:`, file.name, 'type:', file.type, 'size:', file.size);
          text = await extractTextFromFile(file, customPrompt);
          console.log(`Successfully processed:`, file.name);
        } catch (err) {
          console.error(`Error processing file ${file.name}:`, err);
          text = `Error extracting text: ${err instanceof Error ? err.message : 'Unknown error'}`;
        }
        return {
          filename: file.name,
          text,
        };
      })
    );

    console.log('All files processed successfully');
    return NextResponse.json({ results });
  } catch (error) {
    console.error('OCR API Error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}