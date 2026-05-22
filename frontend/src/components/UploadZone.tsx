import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import './UploadZone.css';

interface Props {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

export default function UploadZone({ onUpload, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (file: File) => {
    if (file.type === 'application/pdf') {
      onUpload(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) submit(e.dataTransfer.files[0]);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) submit(file);
    e.target.value = '';
  };

  return (
    <div
      className={[
        'upload-zone',
        dragging ? 'dragging' : '',
        disabled ? 'disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => { if (!disabled) inputRef.current?.click(); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        hidden
      />
      <div className="upload-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 16v1a3 3 0 003 3h12a3 3 0 003-3v-1" strokeLinecap="round" />
        </svg>
      </div>
      <p className="upload-label">Drop a PDF here or <span>click to browse</span></p>
      <p className="upload-hint">AcroForm PDFs only</p>
    </div>
  );
}
