import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractTextFromFile(file: File, customPrompt?: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Check if it's a PDF
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return 'PDF files are not directly supported by OpenAI Vision. Please convert your PDF to images first by taking screenshots of each page, or use a PDF viewer to export pages as images.';
  }
  
  // For images, proceed with OpenAI Vision
  const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
  
  // Use custom prompt if provided, otherwise use default summary prompt
  const systemPrompt = customPrompt 
    ? `You are an expert at processing documents based on user requests. ${customPrompt}`
    : 'You are an expert at extracting and summarizing text from documents. Extract ALL readable text from the file and provide a concise, well-formatted summary that covers all the important information. Maintain the structure and key details while making it easy to read.';
  
  const userPrompt = customPrompt 
    ? customPrompt
    : 'Extract all text from this file and provide a comprehensive but concise summary.';
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 4000,
  });
  
  return completion.choices[0].message.content || 'No text could be extracted from this file.';
} 