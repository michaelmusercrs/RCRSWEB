'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  Star,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'rating' | 'text' | 'yes_no' | 'multiple_choice' | 'nps';
  required: boolean;
  options?: string[];
  order: number;
}

interface Survey {
  id: string;
  name: string;
  type: string;
  questions: SurveyQuestion[];
  isActive: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function PublicSurveyPage() {
  const params = useParams();
  const token = params.token as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  // Fetch survey by token
  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const res = await fetch(`/api/surveys?token=${token}`);
        const data = await res.json();
        if (data.success) {
          setSurvey(data.survey);
          setCustomerName(data.customerName || '');
        } else {
          setError(data.error || 'Survey not found or already completed.');
        }
      } catch (err) {
        setError('Unable to load survey. Please try again later.');
      }
      setLoading(false);
    };
    if (token) fetchSurvey();
  }, [token]);

  const updateAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!survey) return;

    // Validate required questions
    const errors = new Set<string>();
    survey.questions.forEach((q) => {
      if (q.required && (answers[q.id] === undefined || answers[q.id] === '')) {
        errors.add(q.id);
      }
    });

    if (errors.size > 0) {
      setValidationErrors(errors);
      // Scroll to first error
      const firstError = survey.questions.find((q) => errors.has(q.id));
      if (firstError) {
        document.getElementById(`question-${firstError.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSubmitting(true);
    try {
      const answersArray = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value,
      }));

      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers: answersArray }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit survey. Please try again.');
      }
    } catch (err) {
      setError('Unable to submit survey. Please try again later.');
    }
    setSubmitting(false);
  };

  // ─── LOADING STATE ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#39FF14]" />
          <span>Loading survey...</span>
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ──────────────────────────────────────────────────────────

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Survey Not Available</h1>
          <p className="text-gray-500">{error}</p>
          <p className="text-sm text-gray-400 mt-4">
            If you believe this is an error, please contact us at{' '}
            <a href="tel:2562748530" className="text-[#39FF14] hover:underline">(256) 274-8530</a>
          </p>
        </div>
      </div>
    );
  }

  // ─── SUBMITTED STATE ──────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#39FF14]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-[#39FF14]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            {customerName ? `${customerName}, your` : 'Your'} feedback is incredibly valuable to us.
            It helps us continue providing the highest quality roofing services in the Tennessee Valley.
          </p>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <p className="text-sm text-gray-500 mb-3">
              If you&apos;d like to share your experience with others, we&apos;d greatly appreciate a Google review!
            </p>
            <a
              href="https://g.page/r/rivercityroofingsolutions/review"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#39FF14] text-gray-900 font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors"
            >
              <Star className="w-4 h-4" />
              Leave a Google Review
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            River City Roofing Solutions | (256) 274-8530
          </p>
        </div>
      </div>
    );
  }

  // ─── SURVEY FORM ──────────────────────────────────────────────────────────

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
              <span className="text-[#39FF14] font-bold text-lg">RC</span>
            </div>
            <span className="text-xl font-bold text-gray-900">River City Roofing</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{survey.name}</h1>
          {customerName && (
            <p className="text-gray-500 mt-2">Hi {customerName}, we&apos;d love to hear about your experience!</p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            Your honest feedback helps us improve our service. This takes about 2 minutes.
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {survey.questions
          .sort((a, b) => a.order - b.order)
          .map((question, idx) => {
            const hasError = validationErrors.has(question.id);
            return (
              <div
                key={question.id}
                id={`question-${question.id}`}
                className={`bg-white rounded-xl shadow-sm border p-6 transition-colors ${
                  hasError ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#39FF14]/10 text-[#39FF14] text-sm font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">
                      {question.text}
                      {question.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {hasError && (
                      <p className="text-red-500 text-sm mt-1">This question is required</p>
                    )}
                  </div>
                </div>

                {/* Rating type: 1-5 stars */}
                {question.type === 'rating' && (
                  <div className="flex items-center gap-2 ml-10">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => updateAnswer(question.id, val)}
                        className="group p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-10 h-10 transition-colors ${
                            answers[question.id] !== undefined && Number(answers[question.id]) >= val
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300 group-hover:text-yellow-300'
                          }`}
                        />
                      </button>
                    ))}
                    {answers[question.id] !== undefined && (
                      <span className="ml-2 text-sm text-gray-500">
                        {Number(answers[question.id]) === 5 ? 'Excellent!' :
                         Number(answers[question.id]) === 4 ? 'Great' :
                         Number(answers[question.id]) === 3 ? 'Good' :
                         Number(answers[question.id]) === 2 ? 'Fair' : 'Poor'}
                      </span>
                    )}
                  </div>
                )}

                {/* NPS type: 0-10 scale */}
                {question.type === 'nps' && (
                  <div className="ml-10">
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: 11 }, (_, i) => i).map((val) => (
                        <button
                          key={val}
                          onClick={() => updateAnswer(question.id, val)}
                          className={`w-11 h-11 rounded-lg text-sm font-medium transition-colors border ${
                            answers[question.id] !== undefined && Number(answers[question.id]) === val
                              ? val >= 9
                                ? 'bg-green-500 text-white border-green-500'
                                : val >= 7
                                ? 'bg-yellow-500 text-white border-yellow-500'
                                : 'bg-red-500 text-white border-red-500'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-[#39FF14] hover:bg-[#39FF14]/5'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-400 px-1">
                      <span>Not likely at all</span>
                      <span>Extremely likely</span>
                    </div>
                  </div>
                )}

                {/* Text type */}
                {question.type === 'text' && (
                  <div className="ml-10">
                    <textarea
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      placeholder="Share your thoughts..."
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14] resize-none"
                    />
                  </div>
                )}

                {/* Yes/No type */}
                {question.type === 'yes_no' && (
                  <div className="flex gap-3 ml-10">
                    {['Yes', 'No'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => updateAnswer(question.id, opt)}
                        className={`flex-1 py-3 rounded-lg text-sm font-medium border transition-colors ${
                          answers[question.id] === opt
                            ? opt === 'Yes'
                              ? 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]'
                              : 'bg-red-50 text-red-600 border-red-400'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Multiple choice */}
                {question.type === 'multiple_choice' && question.options && (
                  <div className="space-y-2 ml-10">
                    {question.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => updateAnswer(question.id, opt)}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm border transition-colors ${
                          answers[question.id] === opt
                            ? 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            answers[question.id] === opt
                              ? 'border-[#39FF14] bg-[#39FF14]'
                              : 'border-gray-400'
                          }`}>
                            {answers[question.id] === opt && (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              </div>
                            )}
                          </div>
                          {opt}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Submit */}
        <div className="text-center pb-8">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#39FF14] text-gray-900 font-bold text-lg rounded-xl hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#39FF14]/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Feedback
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Your responses are confidential. Thank you for helping us improve!
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 py-6 text-center">
        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} River City Roofing Solutions | (256) 274-8530
        </p>
        <p className="text-xs text-gray-300 mt-1">
          Proudly serving the Tennessee Valley
        </p>
      </div>
    </div>
  );
}
