import React, { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Paperclip, Loader, Send, X } from 'lucide-react';
import { convertPdfToImages } from '@/lib/pdfToImage';

interface Message {
  id: string;
  type: 'file' | 'prompt';
  filename?: string;
  text: string;
  loading?: boolean;
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const OCRChatUploader = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debug selectedFiles changes
  React.useEffect(() => {
    console.log('Selected files changed:', selectedFiles.map(f => f.name));
  }, [selectedFiles]);

  // Handle prompt send
  const handlePromptSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (prompt.trim() === '' && selectedFiles.length === 0) return;
    // Add prompt message if any
    if (prompt.trim() !== '') {
      setMessages((prev) => [
        ...prev,
        {
          id: uniqueId('prompt'),
          type: 'prompt',
          text: prompt,
        },
      ]);
      setPrompt('');
    }
    // Add loading messages for files
    if (selectedFiles.length > 0) {
      setLoading(true);
      const loadingMsgs: Message[] = selectedFiles.map((file) => ({
        id: uniqueId(file.name),
        type: 'file',
        filename: file.name,
        text: 'Processing...',
        loading: true,
      }));
      setMessages((prev) => [...prev, ...loadingMsgs]);
      try {
        const formData = new FormData();
        const fileMapping: { [key: string]: string } = {}; // Map image files back to original files
        
        // Process each file - convert PDFs to images first
        for (const file of selectedFiles) {
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            try {
              // Convert PDF to images
              console.log('Converting PDF to images:', file.name);
              const imageFiles = await convertPdfToImages(file);
              console.log('Converted to', imageFiles.length, 'images');
              imageFiles.forEach((imageFile) => {
                formData.append('files', imageFile);
                fileMapping[imageFile.name] = file.name; // Map image filename to original PDF name
              });
            } catch (pdfError) {
              console.error('PDF conversion error:', pdfError);
              // Add error message for this file
              setMessages((prev) => [
                ...prev.filter((msg) => !loadingMsgs.some((lm) => lm.id === msg.id)),
                {
                  id: uniqueId(file.name),
                  type: 'file',
                  filename: file.name,
                  text: `Error converting PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
                },
              ]);
              continue; // Skip this file and continue with others
            }
          } else {
            // Add image files directly
            formData.append('files', file);
            fileMapping[file.name] = file.name; // Map to itself for direct images
          }
        }
        
        // Process files one by one to avoid token limits
        const allFiles = formData.getAll('files') as File[];
        const results = [];
        
        for (let i = 0; i < allFiles.length; i++) {
          const file = allFiles[i];
          const originalFileName = fileMapping[file.name];
          console.log(`Processing file ${i + 1}/${allFiles.length}:`, file.name, '->', originalFileName);
          
          // Update loading message for the original file
          const currentLoadingMsg = loadingMsgs.find(msg => msg.filename === originalFileName);
          if (currentLoadingMsg) {
            setMessages((prev) => 
              prev.map(msg => 
                msg.id === currentLoadingMsg.id 
                  ? { ...msg, text: `Processing ${originalFileName}...` }
                  : msg
              )
            );
          }
          
          try {
            const singleFormData = new FormData();
            singleFormData.append('files', file);
            
            // Add custom prompt if user typed one
            if (prompt.trim()) {
              singleFormData.append('prompt', prompt.trim());
            }
            
            const res = await fetch('/api/ocr', {
              method: 'POST',
              body: singleFormData,
            });
            
            if (!res.ok) throw new Error('Failed to process file');
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
              results.push(data.results[0]);
              
              // Update message with result for the original file
              setMessages((prev) => [
                ...prev.filter((msg) => !loadingMsgs.some((lm) => lm.id === msg.id && lm.filename === originalFileName)),
                {
                  id: uniqueId(originalFileName),
                  type: 'file',
                  filename: originalFileName,
                  text: data.results[0].text,
                },
              ]);
            }
          } catch (err) {
            console.error(`Error processing file ${file.name}:`, err);
            results.push({
              filename: originalFileName,
              text: `Error extracting text: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
            
            // Update message with error for the original file
            setMessages((prev) => [
              ...prev.filter((msg) => !loadingMsgs.some((lm) => lm.id === msg.id && lm.filename === originalFileName)),
              {
                id: uniqueId(originalFileName),
                type: 'file',
                filename: originalFileName,
                text: `Error extracting text: ${err instanceof Error ? err.message : 'Unknown error'}`,
              },
            ]);
          }
          
          // Small delay between files to avoid rate limits
          if (i < allFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
              } finally {
          setLoading(false);
          // Don't clear files automatically - let users choose when to clear
          // Reset file input to allow new file selection
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
    }
  };

  // Handle file selection (add to selectedFiles)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('File selection event:', files);
    if (!files || files.length === 0) return;
    
    const newFiles = Array.from(files).filter(
      (file) => !selectedFiles.some((f) => f.name === file.name && f.size === file.size)
    );
    
    console.log('Adding new files:', newFiles.map(f => f.name));
    
    setSelectedFiles((prev) => {
      const updated = [...prev, ...newFiles];
      console.log('Updated selected files:', updated.map(f => f.name));
      return updated;
    });
    
    // Don't clear the input value here - let it stay so users can see their selection
  };

  // Remove a file from selectedFiles
  const handleRemoveFile = (name: string, size: number) => {
    setSelectedFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  };

  // Clear all selected files
  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto border rounded-xl shadow-lg bg-white">
      {/* Chat message area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">No messages yet. Upload a file or type a prompt!</div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-full ${msg.type === 'prompt' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`rounded-lg px-4 py-3 shadow-sm ${
                msg.type === 'prompt'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground border'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {msg.type === 'file' && (
                <div className="text-xs font-semibold mb-1 text-gray-500">
                  <Paperclip className="inline w-4 h-4 mr-1" />
                  {msg.filename}
                </div>
              )}
              {msg.loading ? (
                <span className="flex items-center gap-2"><Loader className="animate-spin w-4 h-4" /> Processing...</span>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      {/* Bottom bar */}
      <form
        className="flex flex-col gap-2 border-t p-3 bg-white"
        onSubmit={handlePromptSend}
      >
        {/* File chips */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {selectedFiles.map((file) => (
              <span key={file.name + file.size} className="flex items-center bg-gray-200 rounded px-2 py-1 text-xs font-medium">
                <Paperclip className="w-3 h-3 mr-1" />
                {file.name}
                <button
                  type="button"
                  className="ml-1 text-gray-500 hover:text-red-500"
                  onClick={() => handleRemoveFile(file.name, file.size)}
                  tabIndex={-1}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="text-xs text-red-500 hover:text-red-700 underline"
              onClick={clearAllFiles}
            >
              Clear All
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="cursor-pointer flex items-center">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={loading}
            />
            <Paperclip className="w-6 h-6 text-gray-500 hover:text-primary" />
          </label>
          <Input
            className="flex-1"
            placeholder="Type a prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={(prompt.trim() === '' && selectedFiles.length === 0) || loading}>
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default OCRChatUploader; 