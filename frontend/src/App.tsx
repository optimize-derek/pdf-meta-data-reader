import { useState } from 'react';
import UploadZone from './components/UploadZone';
import FieldsTable from './components/FieldsTable';
import { ExtractResponse } from './types';
import './App.css';

interface RenameRule { from: string; to: string }

export default function App() {
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setUploadedFile(file);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/pdf/extract', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`);
      }
      setResult(await res.json() as ExtractResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (rules: RenameRule[]) => {
    if (!uploadedFile || rules.length === 0) return;
    setApplying(true);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', uploadedFile);
    formData.append('rules', JSON.stringify(rules));

    try {
      const res = await fetch('/api/pdf/rename', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = uploadedFile.name.replace(/\.pdf$/i, '') + '_renamed.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDF Field Labeler</h1>
        <p>Upload an AcroForm PDF to extract and inspect its fields</p>
      </header>

      <main className="app-main">
        <UploadZone onUpload={handleUpload} disabled={loading || applying} />

        {(loading || applying) && (
          <div className="status-bar status-loading">
            {loading ? 'Extracting fields…' : 'Saving renamed PDF…'}
          </div>
        )}
        {error && <div className="status-bar status-error">{error}</div>}
        {result && (
          <FieldsTable result={result} onApply={handleApply} applying={applying} />
        )}
      </main>
    </div>
  );
}
