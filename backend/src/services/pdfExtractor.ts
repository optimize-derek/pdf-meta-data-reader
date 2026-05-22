import {
  PDFDocument,
  PDFField,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  PDFSignature,
  PDFButton,
} from 'pdf-lib';

// pdfjs-dist v4+ requires Node ≥ 22; v3 is the highest compatible version for Node 20.
// The CJS legacy build avoids worker/ESM issues in Node.js.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js') as typeof import('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = ''; // fake-worker in Node.js

import { ExtractedField, ExtractResponse, FieldRect } from '../types.js';

interface RawTextItem {
  str: string;
  transform: number[]; // [a, b, c, d, x, y]
}

function isTextItem(item: unknown): item is RawTextItem {
  return typeof item === 'object' && item !== null && typeof (item as RawTextItem).str === 'string';
}

function getFieldTypeName(field: PDFField): string {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'listbox';
  if (field instanceof PDFSignature) return 'signature';
  if (field instanceof PDFButton) return 'button';
  return 'unknown';
}

/**
 * Finds nearby text using three strategies, scored by proximity:
 *   1. Label to the LEFT on the same line — the most common form pattern
 *   2. Label just ABOVE the field (header-style labels)
 *   3. General proximity fallback (small fields like checkboxes)
 */
function findNearbyText(items: RawTextItem[], rect: FieldRect): string[] {
  const fieldLeft = rect.x;
  const fieldMidY = rect.y + rect.height / 2;
  const fieldTop = rect.y + rect.height; // PDF y-axis: up = higher value

  const candidates: { text: string; score: number }[] = [];

  for (const item of items) {
    const text = item.str.trim();
    if (!text || text.length < 2) continue;

    const tx = item.transform[4];
    const ty = item.transform[5];

    // Strategy 1: label to the left on the same horizontal line
    const vertDiff = Math.abs(ty - fieldMidY);
    const leftDist = fieldLeft - tx;
    if (vertDiff <= 15 && leftDist > 0 && leftDist <= 250) {
      candidates.push({ text, score: 200 - leftDist - vertDiff * 2 });
      continue;
    }

    // Strategy 2: label just above the field
    const aboveDist = ty - fieldTop;
    const withinX = tx >= rect.x - 10 && tx <= rect.x + rect.width + 10;
    if (aboveDist >= 0 && aboveDist <= 35 && withinX) {
      candidates.push({ text, score: 150 - aboveDist * 3 });
      continue;
    }

    // Strategy 3: general proximity (catches inline labels, checkbox options, etc.)
    const cx = rect.x + rect.width / 2;
    const dist = Math.hypot(tx - cx, ty - fieldMidY);
    if (dist <= 60) {
      candidates.push({ text, score: 50 - dist });
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .map((c) => c.text)
    .filter((v, i, arr) => arr.indexOf(v) === i) // deduplicate
    .slice(0, 3);
}

// ── Semantic name generation ──────────────────────────────────────────────────

function toSnakeCase(text: string): string {
  const result = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics (unicode escape, not literals)
    .replace(/\([^)]*\)/g, ' ')        // remove parentheticals like (DD/MM/YYYY)
    .replace(/[^a-z0-9]+/g, '_')       // non-alphanumeric → underscore
    .replace(/^_+|_+$/g, '')           // trim leading/trailing underscores
    .replace(/_+/g, '_')               // collapse runs
    .slice(0, 50)
    .replace(/_+$/, '');               // trim again after truncation
  return result || '';
}

// Short option labels, date tokens, and yes/no words that aren't field labels
const NOISE_RE = /^(yes|no|if yes|if no|n\/a|\d+|dd|mm|yyyy)$/i;

function suggestName(nearbyText: string[], fieldName: string): string {
  // Find the first nearby text that (a) is long enough, (b) isn't pure noise,
  // and (c) produces a meaningful snake_case string (not just underscores/dashes)
  for (const t of nearbyText) {
    if (t.trim().length < 4) continue;
    if (NOISE_RE.test(t.trim())) continue;
    const clean = toSnakeCase(t);
    if (clean.length > 0) return clean;
  }
  // Fall back to the existing field name
  const fromName = toSnakeCase(fieldName ?? '');
  return fromName.length > 0 ? fromName : 'field';
}

function deduplicateNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const count = (seen.get(raw) ?? 0) + 1;
    seen.set(raw, count);
    return count === 1 ? raw : `${raw}_${count}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function extractFields(buffer: Buffer): Promise<ExtractResponse> {
  const pdfDoc = await PDFDocument.load(buffer);
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();

  const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTextItems = new Map<number, RawTextItem[]>();
  for (let i = 0; i < pdfJsDoc.numPages; i++) {
    const pg = await pdfJsDoc.getPage(i + 1);
    const content = await pg.getTextContent();
    pageTextItems.set(i, (content.items as unknown[]).filter(isTextItem));
  }

  // First pass: collect raw field data
  const rawFields: Omit<ExtractedField, 'suggestedName'>[] = [];

  for (const field of form.getFields()) {
    if (field instanceof PDFSignature) continue;
    const name = field.getName();
    const type = getFieldTypeName(field);

    for (const widget of field.acroField.getWidgets()) {
      const rawRect = widget.getRectangle();
      const pageRef = widget.P();
      let pageIdx = pageRef ? pages.findIndex((p) => p.ref === pageRef) : -1;
      if (pageIdx < 0) pageIdx = 0;

      const rect: FieldRect = {
        x: Math.round(rawRect.x),
        y: Math.round(rawRect.y),
        width: Math.round(rawRect.width),
        height: Math.round(rawRect.height),
      };

      const nearbyText = findNearbyText(pageTextItems.get(pageIdx) ?? [], rect);
      rawFields.push({ name, type, page: pageIdx + 1, rect, nearbyText });
    }
  }

  // Second pass: generate + deduplicate suggested names
  const rawNames = rawFields.map((f) => suggestName(f.nearbyText, f.name));
  const dedupedNames = deduplicateNames(rawNames);

  const extracted: ExtractedField[] = rawFields.map((f, i) => ({
    ...f,
    suggestedName: dedupedNames[i],
  }));

  return { fields: extracted, pageCount: pages.length };
}
