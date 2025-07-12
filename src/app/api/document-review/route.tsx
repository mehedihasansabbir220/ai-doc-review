import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromFile } from '@/lib/pdfOcrUtils';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files');
    const companyName = formData.get('companyName') as string;
    const companyImage = formData.get('companyImage') as File | null;
    const companyDescription = formData.get('companyDescription') as string;
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    console.log('Processing document review for company:', companyName);
    console.log('Company image provided:', !!companyImage);
    console.log('Company description provided:', !!companyDescription);

    // Extract text from all files
    const extractedTexts = await Promise.all(
      files.map(async (entry, index) => {
        if (!(entry instanceof File)) {
          return { filename: 'unknown', text: 'Invalid file entry' };
        }
        const file = entry;
        let text = '';
        try {
          console.log(`Processing file ${index + 1}/${files.length}:`, file.name);
          text = await extractTextFromFile(file, 'Extract all relevant information from this document for a comprehensive review.');
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

    // Combine all extracted text
    const combinedText = extractedTexts
      .map(result => `\n--- ${result.filename} ---\n${result.text}`)
      .join('\n\n');

    // Validate documents using AI analysis
    const validationResult = await validateDocumentsWithAI(extractedTexts);
    
    // If documents are missing, return error with missing document list and suggested renames
    if (!validationResult.isComplete) {
      return NextResponse.json({
        error: 'Required documents are missing',
        missingDocuments: validationResult.missingDocuments,
        foundDocuments: validationResult.foundDocuments,
        documentAnalysis: validationResult.documentAnalysis,
        suggestedRenames: validationResult.suggestedRenames,
        message: `Cannot complete document review. The following required documents are missing: ${validationResult.missingDocuments.join(', ')}. Please upload all required documents to proceed.`
      }, { status: 400 });
    }

    // Generate the complete document review using the template
    const review = generateDocumentReview(companyName, combinedText, companyImage, companyDescription, validationResult);

    console.log('Document review generated successfully');
    return NextResponse.json({ 
      review,
      companyName,
      hasCompanyImage: !!companyImage,
      processedFiles: extractedTexts.length,
      validationResult
    });
  } catch (error) {
    console.error('Document Review API Error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

async function validateDocumentsWithAI(extractedTexts: { filename: string; text: string }[]): Promise<{
  isComplete: boolean;
  missingDocuments: string[];
  foundDocuments: string[];
  documentAnalysis: { [filename: string]: { documentType: string; confidence: number; details: string } };
  suggestedRenames: { [filename: string]: string };
}> {
  const requiredDocuments = [
    'condominium declaration',
    'bylaws',
    'financial statements',
    'reserve fund study',
    'insurance certificate',
    'management agreement',
    'budget',
    'rules and regulations',
    'engineering report',
    'status certificate'
  ];

  const documentAnalysis: { [filename: string]: { documentType: string; confidence: number; details: string } } = {};
  const suggestedRenames: { [filename: string]: string } = {};
  const foundDocuments: string[] = [];
  const missingDocuments: string[] = [];

  // Analyze each document individually using AI
  for (const doc of extractedTexts) {
    try {
      const analysis = await analyzeDocumentType(doc.text, doc.filename);
      documentAnalysis[doc.filename] = analysis;
      
      // Generate suggested rename if document type was detected
      if (analysis.documentType !== 'other' && analysis.confidence > 0.5) {
        suggestedRenames[doc.filename] = generateSuggestedFilename(analysis.documentType, doc.filename);
      }
      
      // Check if this document matches any required document type
      const matchedRequiredDoc = findMatchingRequiredDocument(analysis.documentType, requiredDocuments);
      if (matchedRequiredDoc && analysis.confidence > 0.7) {
        foundDocuments.push(matchedRequiredDoc);
      }
    } catch (error) {
      console.error(`Error analyzing document ${doc.filename}:`, error);
      documentAnalysis[doc.filename] = {
        documentType: 'unknown',
        confidence: 0,
        details: 'Error analyzing document'
      };
    }
  }

  // Find missing documents
  for (const requiredDoc of requiredDocuments) {
    if (!foundDocuments.includes(requiredDoc)) {
      missingDocuments.push(requiredDoc);
    }
  }

  return {
    isComplete: missingDocuments.length === 0,
    missingDocuments,
    foundDocuments,
    documentAnalysis,
    suggestedRenames
  };
}

function generateSuggestedFilename(documentType: string, originalFilename: string): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Get file extension from original filename
  const extension = originalFilename.split('.').pop() || 'pdf';
  
  // Create clean document type name
  const cleanDocType = documentType
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
  
  return `${dateStr}_${cleanDocType}.${extension}`;
}

async function analyzeDocumentType(documentText: string, filename: string): Promise<{
  documentType: string;
  confidence: number;
  details: string;
}> {
  const prompt = `Analyze this document and determine what type of legal document it is. 

Document filename: ${filename}

Document content:
${documentText.substring(0, 2000)}...

Please classify this document into one of these categories:
- condominium declaration
- bylaws
- financial statements
- reserve fund study
- insurance certificate
- management agreement
- budget
- rules and regulations
- engineering report
- status certificate
- other

Respond in this exact JSON format:
{
  "documentType": "the_category_name",
  "confidence": 0.95,
  "details": "Brief explanation of why this document matches this category"
}

Confidence should be between 0.0 and 1.0, where 1.0 means you're completely certain.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing legal documents, particularly condominium and real estate documents. You can accurately classify document types based on their content and structure.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from AI');
    }

    // Try to parse JSON response
    try {
      const result = JSON.parse(response);
      return {
        documentType: result.documentType || 'unknown',
        confidence: result.confidence || 0,
        details: result.details || 'No details provided'
      };
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      // If JSON parsing fails, try to extract information from text
      const lowerResponse = response.toLowerCase();
      let documentType = 'other';
      let confidence = 0.5;
      
      if (lowerResponse.includes('condominium declaration') || lowerResponse.includes('declaration')) {
        documentType = 'condominium declaration';
        confidence = 0.8;
      } else if (lowerResponse.includes('bylaws') || lowerResponse.includes('by-laws')) {
        documentType = 'bylaws';
        confidence = 0.8;
      } else if (lowerResponse.includes('financial') || lowerResponse.includes('statement')) {
        documentType = 'financial statements';
        confidence = 0.8;
      } else if (lowerResponse.includes('reserve fund') || lowerResponse.includes('reserve study')) {
        documentType = 'reserve fund study';
        confidence = 0.8;
      } else if (lowerResponse.includes('insurance') || lowerResponse.includes('certificate')) {
        documentType = 'insurance certificate';
        confidence = 0.8;
      } else if (lowerResponse.includes('management agreement')) {
        documentType = 'management agreement';
        confidence = 0.8;
      } else if (lowerResponse.includes('budget')) {
        documentType = 'budget';
        confidence = 0.8;
      } else if (lowerResponse.includes('rules') || lowerResponse.includes('regulations')) {
        documentType = 'rules and regulations';
        confidence = 0.8;
      } else if (lowerResponse.includes('engineering') || lowerResponse.includes('structural')) {
        documentType = 'engineering report';
        confidence = 0.8;
      } else if (lowerResponse.includes('status certificate')) {
        documentType = 'status certificate';
        confidence = 0.8;
      }

      return {
        documentType,
        confidence,
        details: response.substring(0, 200)
      };
    }
  } catch (error) {
    console.error('Error in AI document analysis:', error);
    return {
      documentType: 'unknown',
      confidence: 0,
      details: 'Error analyzing document'
    };
  }
}

function findMatchingRequiredDocument(analyzedType: string, requiredDocuments: string[]): string | null {
  const lowerAnalyzed = analyzedType.toLowerCase();
  
  for (const required of requiredDocuments) {
    const lowerRequired = required.toLowerCase();
    
    // Exact match
    if (lowerAnalyzed === lowerRequired) {
      return required;
    }
    
    // Partial matches
    if (lowerAnalyzed.includes(lowerRequired) || lowerRequired.includes(lowerAnalyzed)) {
      return required;
    }
    
    // Special cases
    if (lowerAnalyzed === 'declaration' && lowerRequired === 'condominium declaration') {
      return required;
    }
    if (lowerAnalyzed === 'by-laws' && lowerRequired === 'bylaws') {
      return required;
    }
    if (lowerAnalyzed === 'financial statement' && lowerRequired === 'financial statements') {
      return required;
    }
    if (lowerAnalyzed === 'reserve study' && lowerRequired === 'reserve fund study') {
      return required;
    }
  }
  
  return null;
}

function generateDocumentReview(
  companyName: string, 
  extractedText: string, 
  companyImage: File | null, 
  companyDescription: string,
  validationResult: { foundDocuments: string[]; documentAnalysis: { [filename: string]: { documentType: string; confidence: number; details: string } } }
): string {
  const imageSection = companyImage 
    ? `\n**Company Image:** [Image provided: ${companyImage.name}]` 
    : '\n**Company Image:** Not provided';

  const companyDescSection = companyDescription 
    ? `\n\n**Company Description:**\n${companyDescription}`
    : '';

  // Create document analysis section
  const documentAnalysisSection = Object.entries(validationResult.documentAnalysis)
    .map(([filename, analysis]) => 
      `**${filename}**: ${analysis.documentType} (Confidence: ${Math.round(analysis.confidence * 100)}%)\n${analysis.details}`
    )
    .join('\n\n');

  return `# Complete Document Review Report

**Company Name:** ${companyName}${imageSection}${companyDescSection}

---

## Executive Summary

We have 20 plus years in the condo industry having worked in condo management, sat on condo boards and reviewing condo documents and being a part of advocacy groups such as CCI Alberta South and ACOC.

We are committed to re-defining the industry of document reviews by providing greater analysis, improved education and understanding.

We're here to collate your information in an easy to read note to protect you from a bad purchase (cole's notes) not meant to be the deciding factor of whether or not you buy but to provide you with a clear and concise document of all information we have been given to aid you in making the decision.

All condo's documents are different and it's important to read through them to pull out the important information to make sure you're making an informed decision when purchasing a property if it's your first home, retirement home or rental property.

---

## ✅ Document Completeness Check

**Status: COMPLETE** ✅

All required legal documents have been provided and reviewed:

${validationResult.foundDocuments.map(doc => `- **${doc.charAt(0).toUpperCase() + doc.slice(1)}** ✅`).join('\n')}

---

## 📋 Document Analysis

${documentAnalysisSection}

---

## Extracted Document Information

${extractedText}

---

## Key Findings & Recommendations

Based on our comprehensive analysis of all provided documents, here are the key points to consider:

### 📊 Financial Assessment
- **Reserve Fund Status**: [Analysis based on financial statements and reserve fund study]
- **Budget Analysis**: [Review of current budget and financial health]
- **Insurance Coverage**: [Assessment of insurance adequacy]

### ⚖️ Legal Compliance
- **Declaration Compliance**: [Review of condominium declaration]
- **Bylaw Analysis**: [Assessment of bylaws and rules]
- **Management Agreement**: [Review of management terms and conditions]

### 🏗️ Physical Condition
- **Engineering Report**: [Assessment of building condition]
- **Maintenance Requirements**: [Analysis of ongoing maintenance needs]

### 💼 Investment Viability
- **Market Position**: [Assessment of property value and market position]
- **Rental Potential**: [Analysis of rental income potential if applicable]
- **Future Value**: [Projection of long-term value]

---

## Risk Assessment

### 🟢 Low Risk Factors
- [List of positive factors found in documents]

### 🟡 Medium Risk Factors
- [List of factors requiring attention]

### 🔴 High Risk Factors
- [List of significant concerns if any]

---

## Recommendations

1. **Immediate Actions**: [Specific actions to take]
2. **Legal Consultation**: [Areas requiring legal review]
3. **Financial Planning**: [Financial considerations]
4. **Due Diligence**: [Additional investigations if needed]

---

## Next Steps

1. **Review this document thoroughly**
2. **Consult with legal professionals** for complete legal advice
3. **Consider additional inspections** if recommended
4. **Make an informed decision** based on all available information
5. **Keep this review for future reference**

---

*This review is provided for informational purposes only and should not be considered as legal, financial, or investment advice. Always consult with qualified professionals before making any purchasing decisions.*`;
} 