'use client';

/**
 * Vendor Price Sheet Upload
 *
 * Admin/office page to upload a vendor PDF price sheet. The server:
 *   1. Uploads the PDF to Vercel Blob.
 *   2. Parses prices via Claude Haiku 4.5 (PDF document input).
 *   3. Fuzzy-matches each extracted row against current inventory.
 *
 * The page surfaces every extracted row with its best match + a check box;
 * the office reviews/edits then clicks Apply to write new unitCost values
 * to inventory + InventoryLogs.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  X,
  RefreshCw,
} from 'lucide-react';

interface ExtractedRow {
  productName: string;
  unit: string;
  price: number;
  sku?: string;
  notes?: string;
}

interface MatchedRow {
  extracted: ExtractedRow;
  match: {
    productId: string;
    productName: string;
    score: number;
    currentUnitCost: number;
  } | null;
}

interface UploadHistoryRow {
  uploadId: string;
  vendorName: string;
  pdfUrl: string;
  extractedRowCount: string;
  matchedCount: string;
  updatedCount: string;
  uploadedBy: string;
  uploadedAt: string;
  effectiveDate: string;
}

interface RowState extends MatchedRow {
  confirmed: boolean;
  overrideCost: string;
}

export default function VendorPricingUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [vendor, setVendor] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [parseResult, setParseResult] = useState<{
    uploadId: string;
    vendorName?: string;
    effectiveDate?: string;
    pdfUrl: string;
    modelUsed?: string;
    rows: RowState[];
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ updated: number; failures: { productId: string; error: string }[] } | null>(null);

  const [history, setHistory] = useState<UploadHistoryRow[]>([]);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/portal/inventory/vendor-pricing');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.uploads || []);
      }
    } catch {
      // best effort
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onUpload = async () => {
    if (!file) {
      setError('Pick a PDF first');
      return;
    }
    setUploading(true);
    setError('');
    setParseResult(null);
    setApplyResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('vendor', vendor);

    try {
      const res = await fetch('/api/portal/inventory/vendor-pricing', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setParseResult({
        uploadId: data.uploadId,
        vendorName: data.vendorName,
        effectiveDate: data.effectiveDate,
        pdfUrl: data.pdfUrl,
        modelUsed: data.modelUsed,
        rows: (data.rows as MatchedRow[]).map((r) => ({
          ...r,
          confirmed: Boolean(r.match && r.match.score >= 0.6),
          overrideCost: String(r.extracted.price),
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onApply = async () => {
    if (!parseResult) return;
    const confirmed = parseResult.rows
      .filter((r) => r.confirmed && r.match)
      .map((r) => ({
        productId: r.match!.productId,
        newUnitCost: Number(r.overrideCost) || r.extracted.price,
        sourceName: r.extracted.productName,
      }));

    if (confirmed.length === 0) {
      setError('No rows confirmed — tick at least one match');
      return;
    }

    setApplying(true);
    setError('');
    setApplyResult(null);
    try {
      const res = await fetch('/api/portal/inventory/vendor-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: parseResult.uploadId,
          vendor: parseResult.vendorName || vendor,
          confirmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setApplyResult({ updated: data.updated, failures: data.failures || [] });
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const toggleRow = (index: number) => {
    if (!parseResult) return;
    const rows = [...parseResult.rows];
    rows[index] = { ...rows[index], confirmed: !rows[index].confirmed };
    setParseResult({ ...parseResult, rows });
  };

  const setRowCost = (index: number, value: string) => {
    if (!parseResult) return;
    const rows = [...parseResult.rows];
    rows[index] = { ...rows[index], overrideCost: value };
    setParseResult({ ...parseResult, rows });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link
          href="/portal/inventory"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-green transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inventory
        </Link>

        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-brand-green" />
          Vendor Price Sheet Upload
        </h1>
        <p className="text-gray-400 mb-8">
          Upload a vendor PDF price sheet. Claude Haiku extracts the rows and matches them
          against inventory. Review, tick the ones to apply, and click Apply to update unitCost.
        </p>

        {error && (
          <div className="bg-red-950 border border-red-700 rounded-lg p-4 mb-4 text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: upload */}
        {!parseResult && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Vendor Name (optional)</label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="SRS, ABC Supply, Beacon, Etc."
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">PDF Price Sheet</label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
              />
              {file && (
                <p className="text-xs text-gray-400 mt-2">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>

            <button
              onClick={onUpload}
              disabled={!file || uploading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-brand-green text-black font-semibold rounded hover:bg-brand-green/80 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing with Claude Haiku...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload & Parse
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: review */}
        {parseResult && !applyResult && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-green" />
                  {parseResult.vendorName || vendor || 'Unknown vendor'}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Extracted {parseResult.rows.length} row
                  {parseResult.rows.length === 1 ? '' : 's'} ·{' '}
                  {parseResult.rows.filter((r) => r.match).length} matched ·{' '}
                  {parseResult.effectiveDate || 'no date'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Parsed by {parseResult.modelUsed || 'claude-haiku-4-5'} ·{' '}
                  <a
                    href={parseResult.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-brand-green"
                  >
                    view PDF
                  </a>
                </p>
              </div>
              <button
                onClick={() => {
                  setParseResult(null);
                  setFile(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-left">Apply</th>
                  <th className="px-3 py-2 text-left">Extracted</th>
                  <th className="px-3 py-2 text-left">Matched Inventory</th>
                  <th className="px-3 py-2 text-right">Current Cost</th>
                  <th className="px-3 py-2 text-right">New Cost</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.rows.map((row, idx) => {
                  const score = row.match?.score || 0;
                  const scoreColor =
                    score >= 0.7
                      ? 'text-green-400'
                      : score >= 0.4
                        ? 'text-yellow-400'
                        : 'text-gray-500';
                  return (
                    <tr key={idx} className="border-t border-zinc-800">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.confirmed}
                          onChange={() => toggleRow(idx)}
                          disabled={!row.match}
                          className="w-4 h-4 accent-brand-green"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold">{row.extracted.productName}</div>
                        <div className="text-xs text-gray-500">
                          ${row.extracted.price.toFixed(2)} / {row.extracted.unit}
                          {row.extracted.sku && ` · SKU ${row.extracted.sku}`}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row.match ? (
                          <>
                            <div className="font-semibold">{row.match.productName}</div>
                            <div className={`text-xs ${scoreColor}`}>
                              {(score * 100).toFixed(0)}% match · {row.match.productId}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500 italic">
                            No match — add manually
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.match ? `$${row.match.currentUnitCost.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.overrideCost}
                          onChange={(e) => setRowCost(idx, e.target.value)}
                          disabled={!row.match}
                          className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-right text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-400">
                {parseResult.rows.filter((r) => r.confirmed).length} row
                {parseResult.rows.filter((r) => r.confirmed).length === 1 ? '' : 's'} confirmed
              </div>
              <button
                onClick={onApply}
                disabled={
                  applying || parseResult.rows.filter((r) => r.confirmed).length === 0
                }
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-green text-black font-semibold rounded hover:bg-brand-green/80 disabled:opacity-50"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Apply to Inventory
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: result */}
        {applyResult && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
              <div>
                <h2 className="text-xl font-bold">
                  Updated {applyResult.updated} item{applyResult.updated === 1 ? '' : 's'}
                </h2>
                <p className="text-sm text-gray-400">
                  Cost changes logged to InventoryLogs.
                </p>
              </div>
            </div>

            {applyResult.failures.length > 0 && (
              <div className="bg-red-950 border border-red-700 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-2">
                  {applyResult.failures.length} failure
                  {applyResult.failures.length === 1 ? '' : 's'}
                </h3>
                <ul className="text-sm space-y-1">
                  {applyResult.failures.map((f, i) => (
                    <li key={i} className="text-red-300">
                      {f.productId}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => {
                setParseResult(null);
                setApplyResult(null);
                setFile(null);
                setVendor('');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Upload another
            </button>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold mb-3">Recent Uploads</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800 text-left">
                  <tr>
                    <th className="px-4 py-2">Vendor</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right">Extracted</th>
                    <th className="px-4 py-2 text-right">Matched</th>
                    <th className="px-4 py-2 text-right">Updated</th>
                    <th className="px-4 py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.uploadId} className="border-t border-zinc-800">
                      <td className="px-4 py-2">
                        {h.pdfUrl ? (
                          <a
                            href={h.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-brand-green underline"
                          >
                            {h.vendorName}
                          </a>
                        ) : (
                          h.vendorName
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {h.uploadedAt
                          ? new Date(h.uploadedAt).toLocaleString()
                          : ''}
                      </td>
                      <td className="px-4 py-2 text-right">{h.extractedRowCount}</td>
                      <td className="px-4 py-2 text-right">{h.matchedCount}</td>
                      <td className="px-4 py-2 text-right">{h.updatedCount}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{h.uploadedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
