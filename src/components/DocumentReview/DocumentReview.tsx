import React, { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Paperclip, Loader, FileText, X, Image as ImageIcon, AlertTriangle, Download, FileDown } from 'lucide-react';
import { convertPdfToImages } from '@/lib/pdfToImage';

type Analysis = {
  documentType?: string;
  confidence?: number;
  details?: string;
};

interface ReviewMessage {
  id: string;
  type: 'user' | 'system' | 'error';
  content: string;
  loading?: boolean;
}

interface CompanyInfo {
  name: string;
  description: string;
  image: File | null;
}

interface SuggestedRename {
  originalName: string;
  suggestedName: string;
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const DocumentReview = () => {
  const [messages, setMessages] = useState<ReviewMessage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', description: '', image: null });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'company-info' | 'review'>('upload');
  const [suggestedRenames, setSuggestedRenames] = useState<SuggestedRename[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('File selection event triggered:', files);
    
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    console.log('Files selected:', Array.from(files).map(f => f.name));
    
    const newFiles = Array.from(files).filter(
      (file) => !selectedFiles.some((f) => f.name === file.name && f.size === file.size)
    );
    
    console.log('New files to add:', newFiles.map(f => f.name));
    
    if (newFiles.length > 0) {
      setSelectedFiles((prev) => {
        const updated = [...prev, ...newFiles];
        console.log('Updated selected files:', updated.map(f => f.name));
        return updated;
      });
    } else {
      console.log('No new files to add (duplicates filtered out)');
    }
    
    // Clear the input value to allow selecting the same file again or multiple files
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      console.log('File input value cleared');
    }
  };

  // Handle company image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setCompanyInfo(prev => ({ ...prev, image: files[0] }));
    
    // Clear the input value to allow selecting the same file again
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Remove a file
  const handleRemoveFile = (name: string, size: number) => {
    setSelectedFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  };

  // Clear all files
  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download renamed file
  const downloadRenamedFile = (originalName: string, suggestedName: string) => {
    const file = selectedFiles.find(f => f.name === originalName);
    if (!file) {
      alert('File not found in your selection. Please re-upload the file and try again.');
      return;
    }

    const renamedFile = new File([file], suggestedName, { type: file.type });
    const url = URL.createObjectURL(renamedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show a success message
    alert(`Downloaded: ${suggestedName}`);
  };

  // Handle next step
  const handleNextStep = () => {
    if (step === 'upload' && selectedFiles.length > 0) {
      setStep('company-info');
      setMessages(prev => [...prev, {
        id: uniqueId('system'),
        type: 'system',
        content: `Great! You've uploaded ${selectedFiles.length} document(s). Now I need some company information to generate your review.`
      }]);
    } else if (step === 'company-info' && companyInfo.name.trim()) {
      setStep('review');
      setMessages(prev => [...prev, {
        id: uniqueId('system'),
        type: 'system',
        content: `Perfect! Now I'll generate a comprehensive document review for ${companyInfo.name}.`
      }]);
      generateReview();
    }
  };

  // Generate the document review
  const generateReview = async () => {
    if (selectedFiles.length === 0 || !companyInfo.name.trim()) return;

    setLoading(true);
    
    // Add loading message
    const loadingMsgId = uniqueId('loading');
    setMessages(prev => [...prev, {
      id: loadingMsgId,
      type: 'system',
      content: 'Generating your document review...',
      loading: true
    }]);

    try {
      const formData = new FormData();
      
      // Process each file - convert PDFs to images first
      for (const file of selectedFiles) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const imageFiles = await convertPdfToImages(file);
            imageFiles.forEach((imageFile) => {
              formData.append('files', imageFile);
            });
          } catch (pdfError) {
            console.error('PDF conversion error:', pdfError);
            continue;
          }
        } else {
          formData.append('files', file);
        }
      }
      
      // Add company information
      formData.append('companyName', companyInfo.name);
      formData.append('companyDescription', companyInfo.description);
      if (companyInfo.image) {
        formData.append('companyImage', companyInfo.image);
      }
      
      const res = await fetch('/api/document-review', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // Handle missing documents error
        if (data.error === 'Required documents are missing') {
          // Create detailed error message with document analysis
          let errorContent = `❌ **Document Review Cannot Be Completed**\n\n**Missing Required Documents:**\n${data.missingDocuments.map((doc: string) => `• ${doc.charAt(0).toUpperCase() + doc.slice(1)}`).join('\n')}\n\n**Documents Found:**\n${data.foundDocuments.map((doc: string) => `• ${doc.charAt(0).toUpperCase() + doc.slice(1)}`).join('\n')}`;
          
          // Add document analysis if available
          if (data.documentAnalysis) {
            errorContent += `\n\n**📋 Document Analysis:**\n`;
            Object.entries(data.documentAnalysis).forEach(([filename, analysis]) => {
              const a = analysis as Analysis;
              const docType = typeof a.documentType === 'string' ? a.documentType : 'unknown';
              const confidence = typeof a.confidence === 'number' ? a.confidence : 0;
              const details = typeof a.details === 'string' ? a.details : '';
              errorContent += `\n**${filename}**:\n`;
              errorContent += `• Type: ${docType}\n`;
              errorContent += `• Confidence: ${Math.round(confidence * 100)}%\n`;
              errorContent += `• Details: ${details}\n`;
            });
          }
          
          errorContent += `\n\n**Please upload all required documents to proceed with the review.**`;
          
          // Store suggested renames for display
          if (data.suggestedRenames) {
            const renames: SuggestedRename[] = Object.entries(data.suggestedRenames).map(([original, suggested]) => ({
              originalName: original,
              suggestedName: suggested as string
            }));
            setSuggestedRenames(renames);
          }
          
          setMessages(prev => [
            ...prev.filter(msg => msg.id !== loadingMsgId),
            {
              id: uniqueId('error'),
              type: 'error',
              content: errorContent
            }
          ]);
          setStep('upload'); // Go back to upload step
        } else {
          throw new Error(data.message || 'Failed to generate review');
        }
      } else {
        // Success - update loading message with the review
        setMessages(prev => prev.map(msg => 
          msg.id === loadingMsgId 
            ? { ...msg, content: data.review, loading: false }
            : msg
        ));
      }
      
    } catch (error) {
      console.error('Error generating review:', error);
      setMessages(prev => [
        ...prev.filter(msg => msg.id !== loadingMsgId),
        {
          id: uniqueId('error'),
          type: 'error',
          content: `Error generating review: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]);
      setStep('upload'); // Go back to upload step
    } finally {
      setLoading(false);
    }
  };

  // Reset everything
  const handleReset = () => {
    setMessages([]);
    setSelectedFiles([]);
    setCompanyInfo({ name: '', description: '', image: null });
    setStep('upload');
    setSuggestedRenames([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-4xl mx-auto border rounded-xl shadow-lg bg-white">
      {/* Header */}
      <div className="border-b p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Document Review</h1>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReset}
            className="text-gray-600 hover:text-gray-800"
          >
            Start Over
          </Button>
        </div>
        
        {/* Progress indicator */}
        <div className="flex items-center gap-4 mt-3">
          <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              1
            </div>
            <span className="text-sm font-medium">Upload Documents</span>
          </div>
          <div className={`flex items-center gap-2 ${step === 'company-info' ? 'text-blue-600' : step === 'review' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'company-info' ? 'bg-blue-600 text-white' : step === 'review' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
              2
            </div>
            <span className="text-sm font-medium">Company Info</span>
          </div>
          <div className={`flex items-center gap-2 ${step === 'review' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'review' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
              3
            </div>
            <span className="text-sm font-medium">Generate Review</span>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && step === 'upload' && (
          <div className="text-center text-gray-400 mt-10">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Upload your documents to get started</p>
            <p className="text-sm">We&apos;ll analyze them and generate a comprehensive review</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-full ${msg.type === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`rounded-lg px-4 py-3 shadow-sm max-w-full ${
                msg.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-white text-gray-800 border'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {msg.loading ? (
                <span className="flex items-center gap-2">
                  <Loader className="animate-spin w-4 h-4" /> 
                  {msg.content}
                </span>
              ) : msg.type === 'error' ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>{msg.content}</div>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {/* Suggested renames section */}
        {suggestedRenames.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Suggested Document Renames
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              We&apos;ve detected the document types. You can download them with proper names for better organization:
            </p>
            <div className="space-y-2">
              {suggestedRenames.map((rename, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded p-3 border">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{rename.originalName}</div>
                    <div className="text-xs text-gray-500">→ {rename.suggestedName}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadRenamedFile(rename.originalName, rename.suggestedName)}
                    className="ml-2"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Bottom section */}
      <div className="border-t p-4 bg-white">
        {step === 'upload' && (
          <div className="space-y-4">
            {/* File upload section */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Upload Documents (PDF, Images) - Multiple files allowed
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.tiff"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Choose Files
                </Button>
                {selectedFiles.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearAllFiles}
                    disabled={loading}
                  >
                    Clear All
                  </Button>
                )}
                <span className="text-xs text-gray-500">
                  {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'No files selected'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                You can select multiple files at once or add files one by one. Supported formats: PDF, PNG, JPG, JPEG, GIF, BMP, TIFF
              </p>
            </div>

            {/* Selected files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Selected Files ({selectedFiles.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file) => (
                    <span key={file.name + file.size} className="flex items-center bg-gray-100 rounded px-3 py-2 text-sm">
                      <Paperclip className="w-4 h-4 mr-2 text-gray-500" />
                      {file.name}
                      <button
                        type="button"
                        className="ml-2 text-gray-500 hover:text-red-500"
                        onClick={() => handleRemoveFile(file.name, file.size)}
                        disabled={loading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={handleNextStep}
              disabled={selectedFiles.length === 0 || loading}
              className="w-full"
            >
              Next: Company Information
            </Button>
          </div>
        )}

        {step === 'company-info' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Company Name *
              </label>
              <Input
                placeholder="Enter your company name"
                value={companyInfo.name}
                onChange={(e) => setCompanyInfo(prev => ({ ...prev, name: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Company Description (Optional)
              </label>
              <Textarea
                placeholder="Describe your company, services, or any additional information..."
                value={companyInfo.description}
                onChange={(e) => setCompanyInfo(prev => ({ ...prev, description: e.target.value }))}
                disabled={loading}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Company Logo/Image (Optional)
              </label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                    disabled={loading}
                  />
                  <Button variant="outline" size="sm" disabled={loading}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Choose Image
                  </Button>
                </label>
                {companyInfo.image && (
                  <span className="text-sm text-gray-600">
                    Selected: {companyInfo.image.name}
                  </span>
                )}
              </div>
            </div>

            <Button 
              onClick={handleNextStep}
              disabled={!companyInfo.name.trim() || loading}
              className="w-full"
            >
              Generate Document Review
            </Button>
          </div>
        )}

        {step === 'review' && loading && (
          <div className="text-center py-4">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">Generating your comprehensive document review...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentReview; 