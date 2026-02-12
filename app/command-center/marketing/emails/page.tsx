'use client';

/**
 * RCRS Command Center - Marketing Email Templates
 *
 * Displays all email templates with preview modal.
 * Includes copy functionality for HTML and plain text.
 *
 * Role-based: Requires marketing.view permission
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Copy,
  Check,
  X,
  Eye,
  Code,
  FileText,
  Clock,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { EMAILS, EmailTemplate, EmailType } from '@/lib/marketing-data';

// Email type styling
const EMAIL_TYPE_STYLES: Record<EmailType, { bg: string; text: string; label: string }> = {
  welcome: { bg: 'bg-lime-500/20', text: 'text-lime-400', label: 'Welcome' },
  storm: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Storm Alert' },
  financing: { bg: 'bg-brand-green/20', text: 'text-blue-400', label: 'Financing' },
  seasonal: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Seasonal' },
  followup: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Follow-up' },
};

// Email card component
interface EmailCardProps {
  email: EmailTemplate;
  onPreview: (email: EmailTemplate) => void;
}

function EmailCard({ email, onPreview }: EmailCardProps) {
  const [copiedHtml, setCopiedHtml] = React.useState(false);
  const [copiedText, setCopiedText] = React.useState(false);

  const typeStyle = EMAIL_TYPE_STYLES[email.type];

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(email.htmlContent);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch {
      // Clipboard API not available or failed silently
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(email.textContent);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Clipboard API not available or failed silently
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700">
      {/* Header */}
      <div className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', typeStyle.bg, typeStyle.text)}>
            {typeStyle.label}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-white">{email.name}</h3>
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500">Subject Line</p>
              <p className="truncate text-sm text-zinc-300">{email.subject}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500">Preheader</p>
              <p className="truncate text-sm text-zinc-400">{email.preheader}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="border-t border-zinc-800 px-5 py-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-zinc-500" />
            <div>
              <p className="text-xs text-zinc-500">Trigger</p>
              <p className="text-zinc-400">{email.trigger}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-500" />
            <div>
              <p className="text-xs text-zinc-500">When to Use</p>
              <p className="text-zinc-400">{email.whenToUse}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 px-5 py-3">
        <button
          onClick={() => onPreview(email)}
          className="flex items-center gap-1.5 rounded-lg bg-lime-500 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-lime-400"
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
        <button
          onClick={copyHtml}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            copiedHtml
              ? 'bg-lime-500/20 text-lime-400'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          )}
        >
          {copiedHtml ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Code className="h-4 w-4" />
              Copy HTML
            </>
          )}
        </button>
        <button
          onClick={copyText}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            copiedText
              ? 'bg-lime-500/20 text-lime-400'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          )}
        >
          {copiedText ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Copy Text
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Preview modal component
interface PreviewModalProps {
  email: EmailTemplate | null;
  onClose: () => void;
}

function PreviewModal({ email, onClose }: PreviewModalProps) {
  const [viewMode, setViewMode] = React.useState<'html' | 'text'>('html');
  const [copiedHtml, setCopiedHtml] = React.useState(false);
  const [copiedText, setCopiedText] = React.useState(false);

  React.useEffect(() => {
    if (email) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [email]);

  if (!email) return null;

  const copyContent = async (type: 'html' | 'text') => {
    try {
      const content = type === 'html' ? email.htmlContent : email.textContent;
      await navigator.clipboard.writeText(content);
      if (type === 'html') {
        setCopiedHtml(true);
        setTimeout(() => setCopiedHtml(false), 2000);
      } else {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
      }
    } catch {
      // Clipboard API not available or failed silently
    }
  };

  const typeStyle = EMAIL_TYPE_STYLES[email.type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-zinc-800 bg-zinc-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', typeStyle.bg, typeStyle.text)}>
                {typeStyle.label}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{email.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">Subject: {email.subject}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3">
          <button
            onClick={() => setViewMode('html')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              viewMode === 'html'
                ? 'bg-lime-500 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
            )}
          >
            <Code className="h-4 w-4" />
            HTML Preview
          </button>
          <button
            onClick={() => setViewMode('text')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              viewMode === 'text'
                ? 'bg-lime-500 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
            )}
          >
            <FileText className="h-4 w-4" />
            Plain Text
          </button>
          <div className="flex-1" />
          <button
            onClick={() => copyContent(viewMode)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              (viewMode === 'html' ? copiedHtml : copiedText)
                ? 'bg-lime-500/20 text-lime-400'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            )}
          >
            {(viewMode === 'html' ? copiedHtml : copiedText) ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy {viewMode === 'html' ? 'HTML' : 'Text'}
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {viewMode === 'html' ? (
            <div className="mx-auto max-w-[620px] overflow-hidden rounded-lg border border-zinc-700">
              <iframe
                srcDoc={email.htmlContent}
                className="h-[600px] w-full bg-white"
                title={`Preview of ${email.name}`}
              />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap rounded-lg bg-zinc-800/50 p-4 font-mono text-sm text-zinc-300">
              {email.textContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketingEmailsPage() {
  const { user } = useAuth();
  const [previewEmail, setPreviewEmail] = React.useState<EmailTemplate | null>(null);

  // Check permission
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'marketing.view');

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Mail className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view Email Templates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/command-center/marketing"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketing Hub
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Email Templates</h1>
            <p className="mt-1 text-zinc-400">
              {EMAILS.length} ready-to-use email templates for Q1 2026
            </p>
          </div>
        </div>
      </div>

      {/* Template Info Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="mb-2 font-medium text-white">Template Variables</h3>
        <p className="text-sm text-zinc-400">
          These templates use merge tags that will be replaced when sent. Available variables:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['{{FirstName}}', '{{ProjectType}}', '{{EstimateAmount}}', '{{SalesRepName}}'].map((tag) => (
            <code
              key={tag}
              className="rounded bg-zinc-800 px-2 py-1 text-xs text-lime-400"
            >
              {tag}
            </code>
          ))}
        </div>
      </div>

      {/* Email Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {EMAILS.map((email) => (
          <EmailCard
            key={email.id}
            email={email}
            onPreview={setPreviewEmail}
          />
        ))}
      </div>

      {/* Preview Modal */}
      <PreviewModal
        email={previewEmail}
        onClose={() => setPreviewEmail(null)}
      />
    </div>
  );
}
