// server/routes/qa.js
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { searchSimilarChunks, getChunkCount } from '../services/vectorStore.mjs';
import { generateAnswer } from '../services/llmService.js';
import { saveChatMessage, getChatHistory } from '../models/User.js';
import { getCodes, getCodeDescription } from '../services/formCodesService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

router.post('/ask', authenticateToken, async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question || question.trim().length < 3) {
      return res.status(400).json({ error: 'Please provide a valid question' });
    }
    
    // Check if we have documents ingested
    const chunkCount = getChunkCount();
    if (chunkCount === 0) {
      return res.status(503).json({ 
        error: 'Knowledge base not yet initialized. Please run document ingestion first.' 
      });
    }
    
    // Find relevant context
    const relevantChunks = await searchSimilarChunks(question, 5);
    
    // Generate answer using LLM with context
    const answer = await generateAnswer(question, relevantChunks);
    
    // Format sources for response
    const sources = relevantChunks.map(chunk => ({
      file: chunk.source_file,
      section: chunk.section,
      page: chunk.page_number,
      relevance: Math.round(chunk.similarity * 100)
    }));
    
    // Save to history
    saveChatMessage(req.user.userId, question, answer, sources);
    
    res.json({ answer, sources });
  } catch (error) {
    console.error('Q&A error:', error);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const history = getChatHistory(req.user.userId, 50);
    res.json(history.map(item => ({
      ...item,
      sources: JSON.parse(item.sources || '[]')
    })));
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  const chunkCount = getChunkCount();
  res.json({ 
    documentsLoaded: chunkCount > 0,
    chunkCount 
  });
});

// IRP5 Form Codes Endpoints
router.get('/form-codes', authenticateToken, async (req, res) => {
  try {
    const codes = await getCodes();
    res.json(codes);
  } catch (error) {
    console.error('Error fetching codes:', error);
    res.status(500).json({ error: 'Failed to fetch form codes' });
  }
});

router.get('/form-code/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const description = await getCodeDescription(code);
    if (description) {
      res.json({ code: code.toUpperCase(), description });
    } else {
      res.status(404).json({ error: 'Code not found' });
    }
  } catch (error) {
    console.error('Error fetching code description:', error);
    res.status(500).json({ error: 'Failed to fetch code description' });
  }
});

// IRP5 PDF Endpoint
router.get('/irp5-pdf', authenticateToken, (req, res) => {
  try {
    const pdfPath = path.join(__dirname, '../../documents/Employee Income Payroll Certificate - IRP5 form.pdf');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="IRP5-form.pdf"'
    });
    res.sendFile(pdfPath);
  } catch (error) {
    console.error('Error serving IRP5 PDF:', error);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
});

export default router;
