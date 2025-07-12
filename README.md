# AI Document Scanner & OCR App

A powerful Next.js application that uses OpenAI Vision to extract and process text from images and PDFs. Features a ChatGPT-like interface with support for multiple file uploads, custom prompts, and intelligent text processing.

## 🚀 Features

### Core Functionality
- **Multi-format Support**: Upload images (PNG, JPG, etc.) and PDFs
- **PDF Processing**: Automatic conversion of PDF pages to images for OCR
- **Smart Summarization**: Default automatic summarization of document content
- **Custom Prompts**: Use specific prompts for tasks like renaming, extracting specific information, or translation
- **Multiple File Upload**: Process multiple files simultaneously with individual results
- **Real-time Processing**: See results as each file completes processing

### User Interface
- **ChatGPT-like Interface**: Clean, modern chat-style UI
- **File Chips**: Visual representation of selected files with remove functionality
- **Loading States**: Real-time progress indicators
- **Responsive Design**: Works on desktop and mobile devices
- **Continuous Workflow**: Upload more files without page reloads

### Technical Features
- **Image Compression**: Automatic compression for faster processing
- **Error Handling**: Robust error handling with detailed feedback
- **Sequential Processing**: Files processed one-by-one to avoid API limits
- **Client-side PDF Conversion**: Browser-based PDF to image conversion
- **TypeScript**: Full type safety throughout the application

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.3.5, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **AI Processing**: OpenAI GPT-4 Vision API
- **PDF Processing**: pdfjs-dist (client-side)
- **Build Tool**: Turbopack for fast development
- **Icons**: Lucide React

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-doc-project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### Basic Usage (Default Summarization)

1. **Upload Files**
   - Click the paperclip icon
   - Select one or more files (images or PDFs)
   - Files will appear as chips below the input

2. **Process Files**
   - Click the send button
   - Watch as each file is processed
   - Results appear in the chat interface

3. **View Results**
   - Each file gets its own response
   - Results include automatic summaries
   - All results remain visible in the chat

### Advanced Usage (Custom Prompts)

1. **Type a Custom Prompt**
   Examples:
   - "Rename this file to something descriptive"
   - "Extract only the contact information"
   - "Summarize in bullet points"
   - "Find all email addresses"
   - "Translate to Spanish"

2. **Upload Files**
   - Select your files as usual

3. **Process with Custom Prompt**
   - Click send
   - AI will process files according to your specific request

### File Management

- **Remove Individual Files**: Click the X button on file chips
- **Clear All Files**: Click "Clear All" button
- **Upload More Files**: Add files anytime without reloading

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |

### Image Compression Settings

The app automatically compresses images for faster processing:

- **Scale**: 1.5x (reduced from 2.0x for smaller files)
- **Format**: JPEG with 70% quality
- **File Size**: ~70% reduction compared to PNG

### API Limits

- **Sequential Processing**: Files processed one-by-one to avoid rate limits
- **Delay**: 500ms between file processing
- **Token Limit**: 4000 tokens per request

## 📁 Project Structure

```
ai-doc-project/
├── src/
│   ├── app/
│   │   ├── api/ocr/
│   │   │   └── route.tsx          # API endpoint for OCR processing
│   │   ├── layout.tsx
│   │   └── page.tsx               # Main page
│   ├── components/
│   │   ├── OCRChatUploader/
│   │   │   ├── OCRChatUploader.tsx # Main chat interface
│   │   │   └── ClientWrapper.tsx
│   │   └── ui/                    # shadcn/ui components
│   └── lib/
│       ├── pdfOcrUtils.ts         # OCR processing logic
│       └── pdfToImage.ts          # PDF to image conversion
├── public/
│   └── pdf.worker.min.js          # PDF.js worker file
├── package.json
└── README.md
```

## 🔍 How It Works

### 1. File Upload
- User selects files through the file input
- Files are added to the `selectedFiles` state
- File chips are displayed in the UI

### 2. PDF Processing (if applicable)
- PDFs are detected by file type or extension
- Each page is converted to a compressed JPEG image
- Images are created using HTML5 Canvas
- File mapping maintains original filename references

### 3. API Processing
- Files are processed sequentially to avoid rate limits
- Each file is sent to the `/api/ocr` endpoint
- Custom prompts are included if provided
- OpenAI Vision API processes the images

### 4. Response Handling
- Results are displayed in the chat interface
- Each file gets its own response message
- Loading states are updated in real-time
- Errors are handled gracefully

## 🎯 Use Cases

### Resume Processing
- Upload resumes in any format
- Extract key information automatically
- Use prompts like "Extract skills and experience"

### Document Analysis
- Process contracts, reports, or forms
- Extract specific data points
- Summarize long documents

### Image Text Extraction
- Extract text from screenshots
- Process handwritten notes
- OCR from photos of documents

### Custom Tasks
- Rename files based on content
- Translate documents
- Extract contact information
- Format data in specific ways

## 🚨 Troubleshooting

### Common Issues

**Files not appearing after selection**
- Check browser console for errors
- Ensure file input is not disabled
- Try refreshing the page

**PDF processing errors**
- Ensure PDF is not corrupted
- Check if PDF is password protected
- Verify PDF.js worker is loading correctly

**API errors**
- Verify OpenAI API key is correct
- Check API quota and billing
- Ensure files are not too large

**Slow processing**
- Large files take longer to process
- Check internet connection
- Consider reducing file sizes

### Debug Mode

The app includes comprehensive logging:
- File selection events
- PDF conversion progress
- API processing status
- Error details

Check browser console (F12) for detailed logs.

## 🔒 Security

- **Client-side Processing**: PDF conversion happens in browser
- **No File Storage**: Files are not stored on server
- **API Key**: Stored securely in environment variables
- **CORS**: Configured for local development

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
2. **Connect to Vercel**
3. **Add environment variables**
4. **Deploy**

### Other Platforms

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

3. **Set environment variables** on your hosting platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for the Vision API
- pdfjs-dist for PDF processing
- shadcn/ui for the component library
- Next.js team for the amazing framework

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review browser console logs
- Open an issue on GitHub

---

**Built with ❤️ using Next.js and OpenAI**
# ai-doc-review
