import { useState } from 'react';
import { ExtractResponse } from '../types';
import './FieldsTable.css';

interface RenameRule { from: string; to: string }

interface Props {
  result: ExtractResponse;
  onApply: (rules: RenameRule[]) => void;
  applying: boolean;
}

export default function FieldsTable({ result, onApply, applying }: Props) {
  const { fields, pageCount } = result;

  const [editedNames, setEditedNames] = useState<string[]>(
    () => fields.map((f) => f.suggestedName),
  );

  const handleNameChange = (i: number, value: string) => {
    setEditedNames((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const handleApply = () => {
    const rules: RenameRule[] = fields
      .map((f, i) => ({ from: f.name, to: editedNames[i].trim() }))
      .filter((r) => r.to.length > 0 && r.to !== r.from);
    onApply(rules);
  };

  const changedCount = fields.filter(
    (f, i) => editedNames[i].trim() !== f.name,
  ).length;

  const handleExportCsv = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ['original_name', 'new_name', 'type', 'page', 'nearby_text'].map(escape).join(','),
      ...fields.map((f, i) =>
        [f.name, editedNames[i].trim(), f.type, String(f.page), f.nearbyText.join(' · ')].map(escape).join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf_fields.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (fields.length === 0) {
    return (
      <div className="fields-section">
        <div className="fields-empty">No AcroForm fields detected in this PDF.</div>
      </div>
    );
  }

  return (
    <div className="fields-section">
      <div className="fields-summary">
        <span>
          Found <strong>{fields.length}</strong> field{fields.length !== 1 ? 's' : ''} across{' '}
          <strong>{pageCount}</strong> page{pageCount !== 1 ? 's' : ''}
        </span>
        <div className="summary-actions">
          <button className="csv-btn" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button
            className="apply-btn"
            onClick={handleApply}
            disabled={applying || changedCount === 0}
          >
            {applying
              ? 'Saving…'
              : changedCount > 0
              ? `Apply & Download PDF (${changedCount} rename${changedCount !== 1 ? 's' : ''})`
              : 'No changes'}
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="fields-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Current Name</th>
              <th>Suggested Name</th>
              <th>Type</th>
              <th>Page</th>
              <th>Nearby Text</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => {
              const edited = editedNames[i];
              const isModified = edited.trim() !== field.name;
              const isFromSuggestion = edited === field.suggestedName && edited !== field.name;
              return (
                <tr key={i}>
                  <td className="col-index">{i + 1}</td>
                  <td className="col-name">
                    {field.name
                      ? <code>{field.name}</code>
                      : <em className="unnamed">unnamed</em>}
                  </td>
                  <td className="col-suggested">
                    <input
                      className={[
                        'name-input',
                        isModified ? 'is-modified' : '',
                        isFromSuggestion ? 'is-suggested' : '',
                      ].filter(Boolean).join(' ')}
                      value={edited}
                      onChange={(e) => handleNameChange(i, e.target.value)}
                      spellCheck={false}
                    />
                  </td>
                  <td>
                    <span className={`badge badge-${field.type}`}>{field.type}</span>
                  </td>
                  <td>{field.page}</td>
                  <td className="col-nearby">
                    {field.nearbyText.length > 0
                      ? field.nearbyText.join(' · ')
                      : <span className="no-text">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
