'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Minus,
  MessageSquare,
  Send,
  Mail,
  BarChart3,
  TrendingUp,
  Target,
  Award,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  MoreVertical,
  AlertCircle,
  ArrowRight,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  X,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface Survey {
  id: string;
  name: string;
  type: string;
  questions: SurveyQuestion[];
  isActive: boolean;
  createdAt: string;
  responseCount?: number;
  avgRating?: number;
}

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'rating' | 'text' | 'yes_no' | 'multiple_choice' | 'nps';
  required: boolean;
  options?: string[];
  order: number;
}

interface SurveyResponse {
  id: string;
  surveyId: string;
  surveyName: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  jobId?: string;
  repSlug?: string;
  repName?: string;
  answers: { questionId: string; value: string | number }[];
  overallRating: number;
  npsScore?: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  submittedAt: string;
  token: string;
  followUpNeeded: boolean;
  followUpNote?: string;
  followUpCompletedAt?: string;
}

interface SurveyAnalytics {
  totalResponses: number;
  avgRating: number;
  npsScore: number;
  responseRate: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  byQuestion: { questionId: string; questionText: string; avgRating?: number; responses: number }[];
  byRep: { repSlug: string; repName: string; avgRating: number; count: number }[];
  trends: { month: string; avgRating: number; count: number }[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SURVEY_TYPE_LABELS: Record<string, string> = {
  post_install: 'Post-Installation',
  annual_checkup: 'Annual Checkup',
  service_call: 'Service Call',
  general: 'General',
};

const SENTIMENT_CONFIG = {
  positive: { label: 'Positive', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: ThumbsUp },
  neutral: { label: 'Neutral', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Minus },
  negative: { label: 'Negative', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: ThumbsDown },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderStars(rating: number, max = 5): React.ReactNode {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
        />
      ))}
      <span className="ml-1 text-sm text-gray-400">{rating.toFixed(1)}</span>
    </div>
  );
}

function getNpsColor(score: number): string {
  if (score >= 50) return 'text-green-400';
  if (score >= 0) return 'text-yellow-400';
  return 'text-red-400';
}

function getNpsLabel(score: number): string {
  if (score >= 50) return 'Excellent';
  if (score >= 0) return 'Good';
  return 'Needs Improvement';
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function SurveysPage() {
  // Active tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'templates' | 'send' | 'analytics' | 'responses'>('dashboard');

  // Data
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Send survey form
  const [sendSurveyId, setSendSurveyId] = useState('');
  const [sendCustomerId, setSendCustomerId] = useState('');
  const [sendCustomerName, setSendCustomerName] = useState('');
  const [sendCustomerEmail, setSendCustomerEmail] = useState('');
  const [sendMethod, setSendMethod] = useState<'email' | 'sms'>('email');
  const [sendRepSlug, setSendRepSlug] = useState('');
  const [sendRepName, setSendRepName] = useState('');
  const [sendJobId, setSendJobId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ url: string; token: string } | null>(null);

  // Create survey modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSurveyName, setNewSurveyName] = useState('');
  const [newSurveyType, setNewSurveyType] = useState('general');
  const [newQuestions, setNewQuestions] = useState<Omit<SurveyQuestion, 'id'>[]>([
    { text: '', type: 'rating', required: true, order: 1 },
  ]);

  // Response detail
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');

  // Filters
  const [filterSurveyId, setFilterSurveyId] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('');
  const [filterFollowUp, setFilterFollowUp] = useState(false);

  // ─── DATA FETCHING ──────────────────────────────────────────────────────────

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await fetch('/api/surveys');
      const data = await res.json();
      if (data.success) setSurveys(data.surveys);
    } catch (err) {
      console.error('Error fetching surveys:', err);
    }
  }, []);

  const fetchResponses = useCallback(async () => {
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getResponses',
          surveyId: filterSurveyId || undefined,
          sentiment: filterSentiment || undefined,
          followUpNeeded: filterFollowUp || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) setResponses(data.responses);
    } catch (err) {
      console.error('Error fetching responses:', err);
    }
  }, [filterSurveyId, filterSentiment, filterFollowUp]);

  const fetchAnalytics = useCallback(async () => {
    try {
      let url = '/api/surveys/analytics';
      const params = new URLSearchParams();
      if (filterSurveyId) params.set('surveyId', filterSurveyId);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setAnalytics(data.analytics);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  }, [filterSurveyId]);

  // ─── INITIAL LOAD ──────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchSurveys(), fetchResponses(), fetchAnalytics()]);
      setLoading(false);
    };
    init();
  }, [fetchSurveys, fetchResponses, fetchAnalytics]);

  // Refetch when filters change
  useEffect(() => {
    fetchResponses();
    fetchAnalytics();
  }, [filterSurveyId, filterSentiment, filterFollowUp, fetchResponses, fetchAnalytics]);

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  const handleSendSurvey = async () => {
    if (!sendSurveyId || !sendCustomerId || !sendCustomerName || !sendCustomerEmail) {
      alert('Please fill in all required fields');
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/surveys/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: sendSurveyId,
          customerId: sendCustomerId,
          customerName: sendCustomerName,
          customerEmail: sendCustomerEmail,
          method: sendMethod,
          repSlug: sendRepSlug || undefined,
          repName: sendRepName || undefined,
          jobId: sendJobId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult({ url: data.surveyUrl, token: data.token });
      } else {
        alert(data.error || 'Failed to send survey');
      }
    } catch (err) {
      console.error('Send error:', err);
      alert('Failed to send survey');
    }
    setSending(false);
  };

  const handleCreateSurvey = async () => {
    if (!newSurveyName) { alert('Survey name is required'); return; }
    const validQuestions = newQuestions.filter((q) => q.text.trim());
    if (validQuestions.length === 0) { alert('At least one question is required'); return; }

    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSurveyName,
          type: newSurveyType,
          questions: validQuestions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewSurveyName('');
        setNewSurveyType('general');
        setNewQuestions([{ text: '', type: 'rating', required: true, order: 1 }]);
        await fetchSurveys();
      } else {
        alert(data.error || 'Failed to create survey');
      }
    } catch (err) {
      console.error('Create error:', err);
    }
  };

  const handleMarkFollowUp = async (responseId: string, completed: boolean) => {
    if (!followUpNote && !completed) { alert('Please enter a follow-up note'); return; }
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markFollowUp',
          responseId,
          note: followUpNote || 'Follow-up completed',
          completed,
        }),
      });
      if ((await res.json()).success) {
        setFollowUpNote('');
        await fetchResponses();
      }
    } catch (err) {
      console.error('Follow-up error:', err);
    }
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <BarChart3 className="w-6 h-6 animate-pulse" />
          <span>Loading surveys...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-[#39FF14]" />
              <h1 className="text-2xl font-bold">Customer Surveys</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['dashboard', 'templates', 'send', 'analytics', 'responses'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30'
                      : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                  }`}
                >
                  {tab === 'dashboard' ? 'Dashboard' : tab === 'templates' ? 'Templates' : tab === 'send' ? 'Send' : tab === 'analytics' ? 'Analytics' : 'Responses'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════════
            DASHBOARD
            ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && analytics && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Total Responses</span>
                  <MessageSquare className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div className="text-3xl font-bold">{analytics.totalResponses}</div>
                <div className="text-xs text-gray-500 mt-1">Response rate: {analytics.responseRate}%</div>
              </div>
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Average Rating</span>
                  <Star className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-3xl font-bold">{analytics.avgRating.toFixed(1)}<span className="text-lg text-gray-500">/5</span></div>
                <div className="mt-1">{renderStars(analytics.avgRating)}</div>
              </div>
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">NPS Score</span>
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
                <div className={`text-3xl font-bold ${getNpsColor(analytics.npsScore)}`}>
                  {analytics.npsScore > 0 ? '+' : ''}{analytics.npsScore}
                </div>
                <div className="text-xs text-gray-500 mt-1">{getNpsLabel(analytics.npsScore)}</div>
              </div>
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Sentiment</span>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1">
                    <div className="h-3 rounded-full bg-gray-700 overflow-hidden flex">
                      {analytics.totalResponses > 0 && (
                        <>
                          <div className="bg-green-500 h-full" style={{ width: `${(analytics.sentimentBreakdown.positive / analytics.totalResponses) * 100}%` }} />
                          <div className="bg-yellow-500 h-full" style={{ width: `${(analytics.sentimentBreakdown.neutral / analytics.totalResponses) * 100}%` }} />
                          <div className="bg-red-500 h-full" style={{ width: `${(analytics.sentimentBreakdown.negative / analytics.totalResponses) * 100}%` }} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span className="text-green-400">{analytics.sentimentBreakdown.positive} pos</span>
                  <span className="text-yellow-400">{analytics.sentimentBreakdown.neutral} neutral</span>
                  <span className="text-red-400">{analytics.sentimentBreakdown.negative} neg</span>
                </div>
              </div>
            </div>

            {/* Recent responses */}
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent Responses</h2>
                <button onClick={() => setActiveTab('responses')} className="text-sm text-[#39FF14] hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {responses.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No responses yet. Send a survey to get started.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {responses.slice(0, 5).map((r) => {
                    const SentimentIcon = SENTIMENT_CONFIG[r.sentiment].icon;
                    return (
                      <div key={r.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="font-medium">{r.customerName}</div>
                          <div className="text-sm text-gray-400">{r.surveyName}</div>
                        </div>
                        <div>{renderStars(r.overallRating)}</div>
                        {r.npsScore !== undefined && (
                          <div className="text-sm text-gray-400">NPS: {r.npsScore}</div>
                        )}
                        <span className={`px-2 py-1 rounded text-xs border flex items-center gap-1 ${SENTIMENT_CONFIG[r.sentiment].color}`}>
                          <SentimentIcon className="w-3 h-3" />
                          {SENTIMENT_CONFIG[r.sentiment].label}
                        </span>
                        {r.followUpNeeded && !r.followUpCompletedAt && (
                          <span className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            Follow-up needed
                          </span>
                        )}
                        <span className="text-xs text-gray-500">{formatDate(r.submittedAt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TEMPLATES
            ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'templates' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Survey Templates</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 rounded-lg text-sm hover:bg-[#39FF14]/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Survey
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {surveys.map((survey) => (
                <div key={survey.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-gray-600 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{survey.name}</h3>
                      <span className="text-xs text-gray-500 px-2 py-0.5 rounded bg-gray-700 mt-1 inline-block">
                        {SURVEY_TYPE_LABELS[survey.type] || survey.type}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${survey.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {survey.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="bg-gray-900/50 rounded-lg p-2">
                      <div className="text-lg font-bold">{survey.questions.length}</div>
                      <div className="text-xs text-gray-500">Questions</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2">
                      <div className="text-lg font-bold">{survey.responseCount || 0}</div>
                      <div className="text-xs text-gray-500">Responses</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2">
                      <div className="text-lg font-bold">{survey.avgRating ? survey.avgRating.toFixed(1) : '-'}</div>
                      <div className="text-xs text-gray-500">Avg Rating</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-500 mb-2">Questions:</div>
                    <div className="space-y-1">
                      {survey.questions.slice(0, 3).map((q) => (
                        <div key={q.id} className="text-xs text-gray-400 truncate flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] flex-shrink-0" />
                          {q.text}
                        </div>
                      ))}
                      {survey.questions.length > 3 && (
                        <div className="text-xs text-gray-500">+{survey.questions.length - 3} more</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Create Survey Modal */}
            {showCreateModal && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Create New Survey</h3>
                    <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Survey Name *</label>
                        <input
                          type="text"
                          value={newSurveyName}
                          onChange={(e) => setNewSurveyName(e.target.value)}
                          placeholder="e.g. Annual Checkup Survey"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Type</label>
                        <select
                          value={newSurveyType}
                          onChange={(e) => setNewSurveyType(e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                        >
                          {Object.entries(SURVEY_TYPE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Questions</label>
                      <div className="space-y-3">
                        {newQuestions.map((q, idx) => (
                          <div key={idx} className="flex gap-2 items-start">
                            <span className="text-xs text-gray-500 mt-2.5 w-4">{idx + 1}.</span>
                            <input
                              type="text"
                              value={q.text}
                              onChange={(e) => {
                                const updated = [...newQuestions];
                                updated[idx] = { ...updated[idx], text: e.target.value };
                                setNewQuestions(updated);
                              }}
                              placeholder="Enter question..."
                              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                            />
                            <select
                              value={q.type}
                              onChange={(e) => {
                                const updated = [...newQuestions];
                                updated[idx] = { ...updated[idx], type: e.target.value as any };
                                setNewQuestions(updated);
                              }}
                              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white w-36"
                            >
                              <option value="rating">Rating (1-5)</option>
                              <option value="nps">NPS (0-10)</option>
                              <option value="text">Text</option>
                              <option value="yes_no">Yes/No</option>
                              <option value="multiple_choice">Multiple Choice</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs text-gray-400 mt-2.5">
                              <input
                                type="checkbox"
                                checked={q.required}
                                onChange={(e) => {
                                  const updated = [...newQuestions];
                                  updated[idx] = { ...updated[idx], required: e.target.checked };
                                  setNewQuestions(updated);
                                }}
                                className="rounded"
                              />
                              Req
                            </label>
                            {newQuestions.length > 1 && (
                              <button
                                onClick={() => setNewQuestions(newQuestions.filter((_, i) => i !== idx))}
                                className="p-2 text-gray-500 hover:text-red-400"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setNewQuestions([...newQuestions, { text: '', type: 'rating', required: true, order: newQuestions.length + 1 }])}
                        className="mt-2 text-sm text-[#39FF14] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add question
                      </button>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-2">
                    <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-600">Cancel</button>
                    <button onClick={handleCreateSurvey} className="px-4 py-2 bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 rounded-lg text-sm hover:bg-[#39FF14]/30">Create Survey</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            SEND SURVEY
            ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'send' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Send className="w-5 h-5 text-[#39FF14]" />
                Send Survey to Customer
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Survey *</label>
                  <select
                    value={sendSurveyId}
                    onChange={(e) => setSendSurveyId(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select a survey...</option>
                    {surveys.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Method</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSendMethod('email')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                        sendMethod === 'email'
                          ? 'bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14]/30'
                          : 'bg-gray-700 text-gray-400 border-gray-600 hover:text-white'
                      }`}
                    >
                      <Mail className="w-4 h-4" /> Email
                    </button>
                    <button
                      onClick={() => setSendMethod('sms')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                        sendMethod === 'sms'
                          ? 'bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14]/30'
                          : 'bg-gray-700 text-gray-400 border-gray-600 hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" /> SMS
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={sendCustomerName}
                    onChange={(e) => setSendCustomerName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Customer Email *</label>
                  <input
                    type="email"
                    value={sendCustomerEmail}
                    onChange={(e) => setSendCustomerEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Customer ID *</label>
                  <input
                    type="text"
                    value={sendCustomerId}
                    onChange={(e) => setSendCustomerId(e.target.value)}
                    placeholder="CUST-12345"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sales Rep (optional)</label>
                  <input
                    type="text"
                    value={sendRepName}
                    onChange={(e) => { setSendRepName(e.target.value); setSendRepSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); }}
                    placeholder="Rep name"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Job ID (optional)</label>
                  <input
                    type="text"
                    value={sendJobId}
                    onChange={(e) => setSendJobId(e.target.value)}
                    placeholder="JOB-12345"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
              </div>

              {/* Preview */}
              {sendSurveyId && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-xs text-gray-500 mb-2">Survey Preview</div>
                  {(() => {
                    const survey = surveys.find((s) => s.id === sendSurveyId);
                    if (!survey) return null;
                    return (
                      <div>
                        <div className="font-medium text-sm mb-2">{survey.name}</div>
                        <div className="space-y-1">
                          {survey.questions.map((q, idx) => (
                            <div key={q.id} className="text-xs text-gray-400 flex items-center gap-2">
                              <span className="text-gray-600">{idx + 1}.</span>
                              {q.text}
                              <span className="px-1 py-0.5 rounded bg-gray-800 text-gray-500">{q.type}</span>
                              {q.required && <span className="text-red-400">*</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                {sendResult && (
                  <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 text-sm text-green-400">
                    Survey sent! Link: <a href={sendResult.url} target="_blank" rel="noopener noreferrer" className="underline">{sendResult.url}</a>
                  </div>
                )}
                <button
                  onClick={handleSendSurvey}
                  disabled={sending || !sendSurveyId || !sendCustomerName || !sendCustomerEmail}
                  className="flex items-center gap-2 px-6 py-3 bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 rounded-lg font-medium hover:bg-[#39FF14]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send Survey'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            ANALYTICS
            ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && analytics && (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-4">
              <select
                value={filterSurveyId}
                onChange={(e) => setFilterSurveyId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">All Surveys</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Monthly rating trend */}
            {analytics.trends.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-[#39FF14]" />
                  Rating Trend
                </h3>
                <div className="flex items-end gap-2 h-40">
                  {analytics.trends.map((t) => {
                    const height = (t.avgRating / 5) * 100;
                    return (
                      <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-400">{t.avgRating.toFixed(1)}</span>
                        <div className="w-full bg-gray-700 rounded-t-md relative" style={{ height: '100%' }}>
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-t-md bg-[#39FF14]/30 border-t-2 border-[#39FF14]"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 mt-1">{t.month}</span>
                        <span className="text-xs text-gray-600">{t.count} resp</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* NPS Gauge */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-blue-400" />
                  NPS Score
                </h3>
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getNpsColor(analytics.npsScore)}`}>
                    {analytics.npsScore > 0 ? '+' : ''}{analytics.npsScore}
                  </div>
                  <div className="text-sm text-gray-400 mt-2">{getNpsLabel(analytics.npsScore)}</div>
                  <div className="mt-4 flex justify-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-green-400 font-bold">
                        {analytics.totalResponses > 0
                          ? Math.round((analytics.sentimentBreakdown.positive / analytics.totalResponses) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-500">Promoters</div>
                    </div>
                    <div className="text-center">
                      <div className="text-yellow-400 font-bold">
                        {analytics.totalResponses > 0
                          ? Math.round((analytics.sentimentBreakdown.neutral / analytics.totalResponses) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-500">Passives</div>
                    </div>
                    <div className="text-center">
                      <div className="text-red-400 font-bold">
                        {analytics.totalResponses > 0
                          ? Math.round((analytics.sentimentBreakdown.negative / analytics.totalResponses) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-500">Detractors</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* By Rep */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-purple-400" />
                  By Sales Rep
                </h3>
                {analytics.byRep.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm">No rep data yet</div>
                ) : (
                  <div className="space-y-3">
                    {analytics.byRep.map((rep) => (
                      <div key={rep.repSlug} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-[#39FF14]">
                          {rep.repName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{rep.repName}</div>
                          <div className="text-xs text-gray-500">{rep.count} responses</div>
                        </div>
                        <div>{renderStars(rep.avgRating)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Question breakdown */}
            {analytics.byQuestion.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  Question Breakdown
                </h3>
                <div className="space-y-3">
                  {analytics.byQuestion.map((q) => (
                    <div key={q.questionId} className="flex items-center gap-4">
                      <div className="flex-1 text-sm text-gray-300 truncate">{q.questionText}</div>
                      <div className="w-20 text-right text-xs text-gray-500">{q.responses} resp</div>
                      {q.avgRating !== undefined && (
                        <div className="w-32">{renderStars(q.avgRating)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            RESPONSES
            ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'responses' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterSurveyId}
                onChange={(e) => setFilterSurveyId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">All Surveys</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={filterSentiment}
                onChange={(e) => setFilterSentiment(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">All Sentiment</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={filterFollowUp}
                  onChange={(e) => setFilterFollowUp(e.target.checked)}
                  className="rounded"
                />
                Follow-up needed only
              </label>
              <span className="text-sm text-gray-500 ml-auto">{responses.length} responses</span>
            </div>

            {/* Response list */}
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              {responses.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No responses match your filters.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {responses.map((r) => {
                    const isExpanded = expandedResponse === r.id;
                    const SentimentIcon = SENTIMENT_CONFIG[r.sentiment].icon;
                    const survey = surveys.find((s) => s.id === r.surveyId);

                    return (
                      <div key={r.id}>
                        {/* Row */}
                        <div
                          className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-700/30"
                          onClick={() => setExpandedResponse(isExpanded ? null : r.id)}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{r.customerName}</div>
                            <div className="text-xs text-gray-500">{r.surveyName}{r.repName ? ` - Rep: ${r.repName}` : ''}</div>
                          </div>
                          <div className="flex-shrink-0">{renderStars(r.overallRating)}</div>
                          {r.npsScore !== undefined && (
                            <span className="text-sm text-gray-400 flex-shrink-0 w-14 text-center">NPS {r.npsScore}</span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs border flex items-center gap-1 flex-shrink-0 ${SENTIMENT_CONFIG[r.sentiment].color}`}>
                            <SentimentIcon className="w-3 h-3" />
                            {SENTIMENT_CONFIG[r.sentiment].label}
                          </span>
                          {r.followUpNeeded && !r.followUpCompletedAt && (
                            <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          )}
                          {r.followUpCompletedAt && (
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          )}
                          <span className="text-xs text-gray-500 flex-shrink-0 w-24 text-right">{formatDate(r.submittedAt)}</span>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-6 pb-4 pl-14 space-y-3">
                            <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                              {r.answers.map((a) => {
                                const question = survey?.questions.find((q) => q.id === a.questionId);
                                return (
                                  <div key={a.questionId} className="flex items-start gap-3 text-sm">
                                    <span className="text-gray-500 flex-shrink-0 w-48 truncate">{question?.text || a.questionId}:</span>
                                    <span className="text-gray-300">
                                      {question?.type === 'rating' ? (
                                        <span className="flex items-center gap-1">
                                          {Array.from({ length: 5 }, (_, i) => (
                                            <Star key={i} className={`w-3 h-3 ${i < Number(a.value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
                                          ))}
                                        </span>
                                      ) : question?.type === 'nps' ? (
                                        <span className={`font-bold ${Number(a.value) >= 9 ? 'text-green-400' : Number(a.value) >= 7 ? 'text-yellow-400' : 'text-red-400'}`}>
                                          {a.value}/10
                                        </span>
                                      ) : (
                                        String(a.value)
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Follow-up section */}
                            {r.followUpNeeded && !r.followUpCompletedAt && (
                              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                                <div className="text-sm text-orange-400 font-medium mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  Follow-up Required
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={followUpNote}
                                    onChange={(e) => setFollowUpNote(e.target.value)}
                                    placeholder="Add follow-up note..."
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleMarkFollowUp(r.id, true); }}
                                    className="px-3 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm hover:bg-green-500/30"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                            {r.followUpNote && (
                              <div className="text-xs text-gray-500">
                                Follow-up: {r.followUpNote}
                                {r.followUpCompletedAt && ` (Completed ${formatDate(r.followUpCompletedAt)})`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
