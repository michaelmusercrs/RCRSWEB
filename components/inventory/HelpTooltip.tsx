'use client';

/**
 * HelpTooltip — plain-language hover hint for any UI element.
 *
 * Usage:
 *   <th>Reorder Level <HelpTooltip text="Stock drops below this → low-stock alert." /></th>
 *   <button>Adjust <HelpTooltip text="Change the on-hand count. Logs who/when/why." /></button>
 *
 * Renders a small "?" icon. Hover (or focus, for keyboard / touch tap) reveals a
 * positioned panel with the help text. Works inside <th>, <td>, buttons, badges.
 *
 * Mobile: tap the icon to toggle (focus state). Tap elsewhere to close.
 */

import * as React from 'react';
import { HelpCircle } from 'lucide-react';

export interface HelpTooltipProps {
  /** Plain-language explanation. Keep under ~140 chars. */
  text: string;
  /** Where to position the tooltip relative to the icon. Defaults to "top". */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Icon size in pixels. Defaults to 14. */
  size?: number;
  /** Extra classes for the wrapping span. */
  className?: string;
  /** Optional aria-label override (defaults to the help text). */
  ariaLabel?: string;
}

export function HelpTooltip({
  text,
  side = 'top',
  size = 14,
  className = '',
  ariaLabel,
}: HelpTooltipProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  const sidePos: Record<NonNullable<HelpTooltipProps['side']>, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <span
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label={ariaLabel || text}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center text-zinc-500 hover:text-[#39FF14] focus:text-[#39FF14] focus:outline-none ml-1 cursor-help"
      >
        <HelpCircle width={size} height={size} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 ${sidePos[side]} w-56 max-w-[15rem] rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 shadow-xl pointer-events-none whitespace-normal leading-snug`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export default HelpTooltip;
