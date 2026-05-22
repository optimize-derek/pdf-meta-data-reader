import { Router, Request, Response } from 'express';
import multer from 'multer';
import { extractFields } from '../services/pdfExtractor';
import { renameFields, RenameRule } from '../services/pdfRenamer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/extract', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file provided' });
      return;
    }
    if (req.file.mimetype !== 'application/pdf') {
      res.status(400).json({ error: 'File must be a PDF' });
      return;
    }
    const result = await extractFields(req.file.buffer);
    res.json(result);
  } catch (err) {
    console.error('Field extraction error:', err);
    res.status(500).json({ error: 'Failed to extract PDF fields' });
  }
});

router.post('/rename', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file provided' });
      return;
    }
    const rules: RenameRule[] = JSON.parse((req.body as { rules?: string }).rules ?? '[]');
    if (!Array.isArray(rules) || rules.length === 0) {
      res.status(400).json({ error: 'No rename rules provided' });
      return;
    }
    const pdfBytes = await renameFields(req.file.buffer, rules);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="renamed.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).json({ error: 'Failed to rename PDF fields' });
  }
});

export default router;
