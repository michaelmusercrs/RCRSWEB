'use client';

/**
 * /portal/settings/notifications/push — ntfy.sh push setup.
 *
 * Free, OSS push channel. This page lets you:
 *   1. See the topic name for each role
 *   2. Send a test notification to any topic
 *   3. Get the mobile-app subscription instructions
 *
 * Topics are stored as env vars (NTFY_TOPIC_*) on the server; this page
 * just renders them and exposes a test-send endpoint.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Bell, Send, Loader2, CheckCircle2, AlertCircle, Copy,
  Smartphone, Globe, RefreshCw,
} from 'lucide-react';

interface PushConfig {
  baseUrl: string;
  topics: Record<string, string>;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  office: 'Office staff (billing, invoicing, customer messages)',
  warehouse: 'PMs and warehouse load events',
  drivers: 'Drivers — pickup, route, delivery confirms',
  admin: 'Admins and owners — escalations and high-priority alerts',
  billing: 'Billing-specific events (invoice sent, payment received)',
};

export default function PushNotificationsPage() {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [result, setResult] = useState<{ topic: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testTitle, setTestTitle] = useState('Test from RCRS');
  const [testMsg, setTestMsg] = useState('This is a test push from the inventory app.');

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/settings/push-notifications');
      if (!res.ok) {
        setError(`Failed to load config (HTTP ${res.status})`);
        return;
      }
      const json = await res.json();
      setConfig(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const sendTest = async (role: string) => {
    setSending(role);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/portal/settings/push-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, title: testTitle, message: testMsg }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setResult({ topic: json.topic, ok: json.ok });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(null);
    }
  };

  const copy = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/settings/notifications" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6" /> Push Notifications (ntfy)
            </h1>
            <p className="text-sm text-gray-500">
              Free, open-source push channel. Subscribe from your phone, no account needed.
            </p>
          </div>
        </div>
        <button onClick={fetchConfig} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Setup instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <h2 className="font-semibold flex items-center gap-2">
          <Smartphone className="w-5 h-5" /> Subscribe on your phone
        </h2>
        <ol className="text-sm text-blue-900 list-decimal list-inside space-y-1">
          <li>Install the <strong>ntfy</strong> app (iOS App Store, Google Play, or <a href="https://ntfy.sh" target="_blank" rel="noopener" className="underline">ntfy.sh</a> in your browser).</li>
          <li>Tap <em>Subscribe to topic</em> and paste your role's topic name from the list below.</li>
          <li>Optional: enable instant delivery in app settings for sub-second pushes.</li>
        </ol>
        {config && (
          <p className="text-xs text-blue-700 mt-2">
            <Globe className="w-3 h-3 inline" /> Server: <code className="font-mono">{config.baseUrl}</code>
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {result && (
        <div className={`rounded-lg p-3 flex items-center gap-2 text-sm border ${
          result.ok
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {result.ok
            ? `Push delivered to topic "${result.topic}". Check your subscribed devices.`
            : `Push to topic "${result.topic}" failed — check NTFY_BASE_URL env and topic name.`}
        </div>
      )}

      {/* Test message */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <h2 className="font-semibold">Test message</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
            <input
              value={testTitle}
              onChange={e => setTestTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
            <input
              value={testMsg}
              onChange={e => setTestMsg(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* Per-role topics */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">Topics by role</div>
        {loading && !config ? (
          <div className="p-10 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : config ? (
          <div className="divide-y">
            {Object.entries(config.topics).map(([role, topic]) => (
              <div key={role} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-medium capitalize">{role}</div>
                  <div className="text-xs text-gray-500">{ROLE_DESCRIPTIONS[role] || ''}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{topic}</code>
                    <button
                      onClick={() => copy(topic)}
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      title="Copy topic name"
                    >
                      <Copy className="w-3 h-3" /> copy
                    </button>
                    <a
                      href={`${config.baseUrl}/${encodeURIComponent(topic)}`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      open in browser ↗
                    </a>
                  </div>
                </div>
                <button
                  onClick={() => sendTest(role)}
                  disabled={sending === role}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {sending === role ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send test
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
