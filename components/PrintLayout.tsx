'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Printer, Download, CheckSquare, Square } from 'lucide-react';

// ── Print Header (shown at top of every printed page) ──────────────────────

export function PrintHeader({ 
  title = 'Report',
  subtitle,
  date,
}: { 
  title?: string;
  subtitle?: string;
  date?: string;
}) {
  const displayDate = date || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="print-only hidden mb-6">
      <div className="flex items-center justify-between pb-3 border-b-2 border-green-600">
        <div className="flex items-center gap-3">
          <Image src="/logo-transparent.png" alt="RCRS" width={48} height={48} className="rounded-lg" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p className="font-semibold text-gray-700">River City Roofing Solutions</p>
          <p>(256) 274-8530 · rivercityroofingsolutions.com</p>
          <p>Generated: {displayDate}</p>
        </div>
      </div>
    </div>
  );
}

// ── Print Footer (shown at bottom of printed pages) ────────────────────────

export function PrintFooter() {
  return (
    <div className="print-only hidden mt-8 pt-3 border-t border-gray-300">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <p>© {new Date().getFullYear()} River City Roofing Solutions · (256) 274-8530 · info@rcrsal.com</p>
        <p>Confidential — For intended recipient only</p>
      </div>
    </div>
  );
}

// ── Section Toggle (checkboxes to pick which sections to print) ────────────

interface PrintSection {
  id: string;
  label: string;
  defaultOn?: boolean;
}

export function PrintSectionToggle({
  sections,
  onToggle,
  enabledSections,
}: {
  sections: PrintSection[];
  onToggle: (id: string) => void;
  enabledSections: Set<string>;
}) {
  return (
    <div className="no-print bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-green-600" />
        Select sections to include in print/PDF:
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {sections.map(section => {
          const enabled = enabledSections.has(section.id);
          return (
            <label
              key={section.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                enabled ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => onToggle(section.id)}
                className="sr-only"
              />
              {enabled ? <CheckSquare className="w-4 h-4 text-green-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
              {section.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Print/PDF Toolbar ──────────────────────────────────────────────────────

export function PrintToolbar({ className }: { className?: string }) {
  return (
    <div className={`no-print flex items-center gap-2 ${className || ''}`}>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
      >
        <Printer className="w-4 h-4" />
        Print Report
      </button>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Download className="w-4 h-4" />
        Save as PDF
      </button>
    </div>
  );
}

// ── usePrintSections hook ──────────────────────────────────────────────────

export function usePrintSections(sections: PrintSection[]) {
  const [enabledSections, setEnabledSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.defaultOn !== false).map(s => s.id))
  );

  const toggle = useCallback((id: string) => {
    setEnabledSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSectionVisible = useCallback((id: string) => enabledSections.has(id), [enabledSections]);

  return { enabledSections, toggle, isSectionVisible };
}
