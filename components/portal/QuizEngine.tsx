'use client';

import { useState, useCallback } from 'react';
import { 
  CheckCircle2, XCircle, ChevronRight, ChevronLeft, RotateCcw,
  Trophy, Target, AlertCircle, Zap, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  category: string;
}

export interface QuizData {
  quizId: string;
  title: string;
  description: string;
  icon: string;
  passingScore: number;
  timeLimit: number | null;
  questions: QuizQuestion[];
}

interface QuizEngineProps {
  quiz: QuizData;
  onComplete?: (score: number, total: number) => void;
  onBack?: () => void;
}

type AnswerState = {
  selected: number | null;
  revealed: boolean;
};

export default function QuizEngine({ quiz, onComplete, onBack }: QuizEngineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const current = quiz.questions[currentIndex];
  const answer = answers[currentIndex] || { selected: null, revealed: false };
  const totalAnswered = Object.values(answers).filter(a => a.revealed).length;
  const correctCount = Object.entries(answers).filter(
    ([idx, a]) => a.revealed && a.selected === quiz.questions[Number(idx)].correct
  ).length;

  const selectOption = useCallback((optionIndex: number) => {
    if (answer.revealed) return;
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: { selected: optionIndex, revealed: false }
    }));
  }, [answer.revealed, currentIndex]);

  const confirmAnswer = useCallback(() => {
    if (answer.selected === null) return;
    const isCorrect = answer.selected === current.correct;
    
    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
    } else {
      setStreak(0);
    }

    setAnswers(prev => ({
      ...prev,
      [currentIndex]: { ...prev[currentIndex], revealed: true }
    }));
  }, [answer.selected, current.correct, currentIndex, streak, bestStreak]);

  const goNext = useCallback(() => {
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setFinished(true);
      onComplete?.(correctCount + (answer.selected === current.correct ? 1 : 0), quiz.questions.length);
    }
  }, [currentIndex, quiz.questions.length, correctCount, answer.selected, current.correct, onComplete]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  }, [currentIndex]);

  const restart = useCallback(() => {
    setAnswers({});
    setCurrentIndex(0);
    setFinished(false);
    setStreak(0);
    setBestStreak(0);
  }, []);

  const finalCorrect = Object.entries(answers).filter(
    ([idx, a]) => a.revealed && a.selected === quiz.questions[Number(idx)].correct
  ).length;
  const scorePercent = Math.round((finalCorrect / quiz.questions.length) * 100);
  const passed = scorePercent >= quiz.passingScore;

  if (finished) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className={`rounded-2xl p-8 text-center ${
          passed 
            ? 'bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/30' 
            : 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30'
        }`}>
          <div className="text-6xl mb-4">
            {passed ? '🏆' : scorePercent >= 60 ? '💪' : '📚'}
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {passed ? 'You Crushed It!' : scorePercent >= 60 ? 'Almost There!' : 'Time to Study Up'}
          </h2>
          <p className="text-zinc-400 mb-6">
            {passed 
              ? "You clearly know your stuff. Now go put it to work." 
              : "Review the material and give it another shot. Nobody gets it perfect the first time."}
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <div className="text-3xl font-bold text-white">{scorePercent}%</div>
              <div className="text-sm text-zinc-500">Score</div>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <div className="text-3xl font-bold text-white">{finalCorrect}/{quiz.questions.length}</div>
              <div className="text-sm text-zinc-500">Correct</div>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <div className="text-3xl font-bold text-white">{bestStreak}</div>
              <div className="text-sm text-zinc-500">Best Streak 🔥</div>
            </div>
          </div>

          {/* Missed questions review */}
          {!passed && (
            <div className="text-left mb-8">
              <h3 className="text-lg font-semibold text-white mb-3">Questions to Review:</h3>
              <div className="space-y-3">
                {Object.entries(answers)
                  .filter(([idx, a]) => a.selected !== quiz.questions[Number(idx)].correct)
                  .map(([idx]) => {
                    const q = quiz.questions[Number(idx)];
                    return (
                      <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                        <p className="text-sm text-zinc-300 font-medium">{q.question}</p>
                        <p className="text-xs text-emerald-400 mt-1">✓ {q.options[q.correct]}</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button onClick={restart} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
            {onBack && (
              <Button onClick={onBack} className="gap-2 bg-blue-600 hover:bg-blue-700">
                Back to Quizzes
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">
            Question {currentIndex + 1} of {quiz.questions.length}
          </span>
          <div className="flex items-center gap-3">
            {streak >= 2 && (
              <span className="text-sm font-medium text-orange-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> {streak} streak!
              </span>
            )}
            <span className="text-sm text-zinc-500">
              {correctCount}/{totalAnswered} correct
            </span>
          </div>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
            style={{ width: `${((currentIndex + (answer.revealed ? 1 : 0)) / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Category badge */}
      <div className="mb-3">
        <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {current.category}
        </span>
      </div>

      {/* Question */}
      <h2 className="text-xl font-semibold text-white mb-6 leading-relaxed">
        {current.question}
      </h2>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {current.options.map((option, idx) => {
          const isSelected = answer.selected === idx;
          const isCorrect = idx === current.correct;
          const isRevealed = answer.revealed;

          let className = 'w-full text-left p-4 rounded-xl border transition-all duration-200 ';
          
          if (isRevealed) {
            if (isCorrect) {
              className += 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300';
            } else if (isSelected && !isCorrect) {
              className += 'bg-red-500/10 border-red-500/40 text-red-300';
            } else {
              className += 'bg-zinc-800/30 border-zinc-700/30 text-zinc-500';
            }
          } else if (isSelected) {
            className += 'bg-blue-500/10 border-blue-500/40 text-white ring-1 ring-blue-500/30';
          } else {
            className += 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 cursor-pointer';
          }

          return (
            <button
              key={idx}
              onClick={() => selectOption(idx)}
              disabled={isRevealed}
              className={className}
            >
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                  isRevealed && isCorrect ? 'bg-emerald-500/20 text-emerald-400' :
                  isRevealed && isSelected && !isCorrect ? 'bg-red-500/20 text-red-400' :
                  isSelected ? 'bg-blue-500/20 text-blue-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {isRevealed && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                   isRevealed && isSelected && !isCorrect ? <XCircle className="w-4 h-4" /> :
                   String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm leading-relaxed">{option}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {answer.revealed && (
        <div className={`mb-6 p-4 rounded-xl border ${
          answer.selected === current.correct 
            ? 'bg-emerald-500/5 border-emerald-500/20' 
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-start gap-2">
            <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              answer.selected === current.correct ? 'text-emerald-400' : 'text-amber-400'
            }`} />
            <p className="text-sm text-zinc-300 leading-relaxed">{current.explanation}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          onClick={goPrev}
          variant="ghost"
          disabled={currentIndex === 0}
          className="gap-1 text-zinc-400 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>

        {!answer.revealed ? (
          <Button
            onClick={confirmAnswer}
            disabled={answer.selected === null}
            className="gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-30"
          >
            Lock In Answer
          </Button>
        ) : (
          <Button
            onClick={goNext}
            className="gap-1 bg-blue-600 hover:bg-blue-700"
          >
            {currentIndex === quiz.questions.length - 1 ? 'See Results' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
