import { PDFDocument, PDFName, PDFString } from 'pdf-lib';

export interface RenameRule {
  from: string;
  to: string;
}

export async function renameFields(buffer: Buffer, rules: RenameRule[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(buffer);
  const form = pdfDoc.getForm();
  const ruleMap = new Map(rules.map((r) => [r.from, r.to]));

  for (const field of form.getFields()) {
    const newName = ruleMap.get(field.getName());
    if (newName !== undefined) {
      // The partial field name lives in the /T entry of the AcroField dict
      field.acroField.dict.set(PDFName.of('T'), PDFString.of(newName));
    }
  }

  return pdfDoc.save();
}
