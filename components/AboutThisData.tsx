'use client';

/**
 * AboutThisData — reusable explainer panel for every chrisview page.
 *
 * Standard footer (and optional inline) component that surfaces:
 *   - Where the data came from (which file, which API, which sheet tab)
 *   - How it's calculated (the actual formula / decision logic)
 *   - What it's good for (practical uses the analyst should apply it to)
 *   - Known gaps (data limitations the reader should keep in mind)
 *   - When it was last refreshed
 *
 * Per Michael's 2026-05-21 brief: each page should make its own
 * provenance and method explicit so Chris doesn't have to dig.
 */

import { Info, BookOpen, Lightbulb, AlertTriangle, Clock } from 'lucide-react';

interface AboutThisDataProps {
  /** One-line label, e.g. "About this page" */
  title?: string;
  /** Where the data comes from. Be specific — file/API/sheet/tab. */
  source: string;
  /** How the displayed numbers are computed. Plain English. */
  method: string;
  /** Optional practical-use note for the analyst. */
  uses?: string;
  /** Optional gap/caveat the reader should know about. */
  gaps?: string;
  /** Optional ISO timestamp string (or human "May 21, 2026"). */
  generatedAt?: string;
}

export default function AboutThisData({
  title = 'About this page',
  source,
  method,
  uses,
  gaps,
  generatedAt,
}: AboutThisDataProps) {
  return (
    <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-zinc-200">
        <Info className="w-4 h-4 text-[#39FF14]" />
        {title}
      </h3>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <dt className="text-zinc-500 uppercase font-mono mb-1 flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" />
            Source data
          </dt>
          <dd className="text-zinc-300 leading-relaxed">{source}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 uppercase font-mono mb-1 flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            Calculation method
          </dt>
          <dd className="text-zinc-300 leading-relaxed">{method}</dd>
        </div>
        {uses && (
          <div>
            <dt className="text-zinc-500 uppercase font-mono mb-1 flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3" />
              Potential uses
            </dt>
            <dd className="text-zinc-300 leading-relaxed">{uses}</dd>
          </div>
        )}
        {gaps && (
          <div>
            <dt className="text-amber-400/70 uppercase font-mono mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Known gaps
            </dt>
            <dd className="text-amber-200/80 leading-relaxed">{gaps}</dd>
          </div>
        )}
      </dl>
      {generatedAt && (
        <p className="text-[10px] text-zinc-600 mt-4 font-mono flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Last refreshed: {generatedAt}
        </p>
      )}
    </section>
  );
}
