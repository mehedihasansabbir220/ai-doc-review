import * as pdfjsLib from 'pdfjs-dist';

// Use local worker file to avoid CORS issues
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Compress image to reduce size for faster processing
function compressImage(canvas: HTMLCanvasElement, quality: number = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to compress image'));
      }
    }, 'image/jpeg', quality); // Use JPEG with compression
  });
}

export async function convertPdfToImages(file: File): Promise<File[]> {
  try {
    console.log('Starting PDF conversion for:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    console.log('File loaded, size:', arrayBuffer.byteLength);
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('PDF loaded, pages:', pdf.numPages);
    
    const imageFiles: File[] = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log('Processing page', pageNum);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 }); // Reduced scale for smaller files
      
      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      console.log('Rendering page', pageNum, 'to canvas');
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      console.log('Compressing image for page', pageNum);
      // Compress image to reduce size
      const blob = await compressImage(canvas, 0.7);
      
      // Create file from compressed blob
      const imageFile = new File([blob], `${file.name.replace('.pdf', '')}_page_${pageNum}.jpg`, {
        type: 'image/jpeg'
      });
      
      console.log('Created compressed image file for page', pageNum, 'size:', imageFile.size);
      imageFiles.push(imageFile);
    }
    
    console.log('PDF conversion completed, created', imageFiles.length, 'compressed images');
    return imageFiles;
  } catch (error) {
    console.error('PDF conversion failed:', error);
    throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 