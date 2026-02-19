'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rocket, Layout, GraduationCap, Zap, PartyPopper,
  ChevronRight, ChevronLeft, Loader2,
  BarChart3, Truck, FileText, Calendar, Settings, Users
} from 'lucide-react';
import { useAuth, ROLE_DEFAULT_ROUTES } from '@/lib/auth-context';
import { TeamRole } from '@/lib/team-roles';

const ROLE_FEATURES: Record<TeamRole, { icon: React.ReactNode; items: string[] }> = {
  sales: {
    icon: <BarChart3 size={24} />,
    items: ['Lead management & tracking', 'Schedule roof inspections', 'Commission tracking & leaderboard', 'Create & send customer quotes'],
  },
  driver: {
    icon: <Truck size={24} />,
    items: ['Delivery queue & priority view', 'GPS route navigation', 'Photo upload & proof of delivery', 'Inventory pickup & returns'],
  },
  office: {
    icon: <FileText size={24} />,
    items: ['Billing & invoice management', 'Inventory tracking & ordering', 'Schedule coordination', 'Vendor management'],
  },
  project_manager: {
    icon: <Calendar size={24} />,
    items: ['Job scheduling & timelines', 'Delivery coordination', 'Material order management', 'Team schedule overview'],
  },
  manager: {
    icon: <Users size={24} />,
    items: ['Operations oversight dashboard', 'Team performance reports', 'Lead distribution management', 'Cross-department visibility'],
  },
  owner: {
    icon: <Settings size={24} />,
    items: ['Full system access & settings', 'Team management & permissions', 'Financial reports & analytics', 'Lead distribution configuration'],
  },
  admin: {
    icon: <Settings size={24} />,
    items: ['Full system access & settings', 'Team management & permissions', 'Financial reports & analytics', 'Lead distribution configuration'],
  },
  viewer: {
    icon: <BarChart3 size={24} />,
    items: ['Dashboard overview', 'Reports access', 'Read-only data views'],
  },
};

const TRAINING_PATHS = [
  'Training Library (AI Deep Dives)',
  'NotebookLM Guide',
  'Sales Training',
  'Platform Onboarding',
  'Role-Based Modules',
  'Personal Walkthroughs',
];

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  const role = user.role;
  const features = ROLE_FEATURES[role] || ROLE_FEATURES.viewer;

  const handleComplete = () => {
    localStorage.setItem(`onboarding_complete_${user.userId}`, 'true');
    router.push(ROLE_DEFAULT_ROUTES[role]);
  };

  const steps = [
    // Step 1: Welcome
    <div key="welcome" className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-brand-green/20 rounded-2xl flex items-center justify-center">
        <Rocket className="text-brand-green" size={40} />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-3">Welcome to RoofStack</h2>
        <p className="text-neutral-400 text-lg max-w-sm mx-auto">
          Your all-in-one platform for managing roofing operations — from leads to deliveries, all under one roof.
        </p>
      </div>
      <div className="text-sm text-neutral-500">
        Hey {user.name.split(' ')[0]}, let&apos;s show you around! 👋
      </div>
    </div>,

    // Step 2: Your Dashboard
    <div key="dashboard" className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-blue-500/20 rounded-2xl flex items-center justify-center">
        <Layout className="text-blue-400" size={40} />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-3">Your Dashboard</h2>
        <p className="text-neutral-400 text-lg max-w-sm mx-auto">
          Your personalized dashboard shows everything relevant to your role at a glance.
        </p>
      </div>
      <div className="bg-neutral-800/50 rounded-2xl border border-neutral-700/50 p-6 text-left max-w-sm mx-auto">
        <div className="text-sm text-neutral-500 mb-2">Your default view</div>
        <div className="text-white font-semibold text-lg">{ROLE_DEFAULT_ROUTES[role]}</div>
        <div className="text-neutral-400 text-sm mt-1">
          This is where you&apos;ll land each time you log in.
        </div>
      </div>
    </div>,

    // Step 3: Training Academy
    <div key="training" className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-purple-500/20 rounded-2xl flex items-center justify-center">
        <GraduationCap className="text-purple-400" size={40} />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-3">Training Academy</h2>
        <p className="text-neutral-400 text-lg max-w-sm mx-auto">
          Level up your skills with our built-in training paths.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {TRAINING_PATHS.map((path) => (
          <div key={path} className="bg-neutral-800/50 rounded-xl border border-neutral-700/50 p-3 text-sm text-neutral-300">
            {path}
          </div>
        ))}
      </div>
      <div className="text-sm text-neutral-500">
        Access anytime at <span className="text-purple-400">/portal/training</span>
      </div>
    </div>,

    // Step 4: Role Features
    <div key="features" className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400">
        <Zap size={40} />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-3">Key Features for You</h2>
        <p className="text-neutral-400 text-lg max-w-sm mx-auto">
          Here&apos;s what&apos;s available for your role.
        </p>
      </div>
      <div className="space-y-3 max-w-sm mx-auto text-left">
        {features.items.map((item) => (
          <div key={item} className="flex items-center gap-3 bg-neutral-800/50 rounded-xl border border-neutral-700/50 p-4">
            <div className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0" />
            <span className="text-neutral-200">{item}</span>
          </div>
        ))}
      </div>
    </div>,

    // Step 5: All Set
    <div key="done" className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-brand-green/20 rounded-2xl flex items-center justify-center">
        <PartyPopper className="text-brand-green" size={40} />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-3">You&apos;re All Set!</h2>
        <p className="text-neutral-400 text-lg max-w-sm mx-auto">
          You&apos;re ready to go. Dive into your dashboard or start training.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
        <button
          onClick={handleComplete}
          className="flex-1 bg-gradient-to-r from-brand-green to-emerald-500 text-black font-bold py-4 rounded-xl shadow-lg shadow-brand-green/25 hover:from-brand-green/90 hover:to-emerald-500/90 transition-all"
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => {
            localStorage.setItem(`onboarding_complete_${user.userId}`, 'true');
            router.push('/portal/training');
          }}
          className="flex-1 bg-neutral-800 text-white font-bold py-4 rounded-xl border border-neutral-700 hover:bg-neutral-700 transition-all"
        >
          Start Training
        </button>
      </div>
    </div>,
  ];

  const totalSteps = steps.length;
  const isLast = step === totalSteps - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-8">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step ? 'w-8 bg-brand-green' : i < step ? 'w-2 bg-brand-green/50' : 'w-2 bg-neutral-700'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm p-8 min-h-[400px] flex items-center justify-center">
            {steps[step]}
          </div>

          {/* Navigation */}
          {!isLast && (
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="flex items-center gap-2 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 bg-brand-green/20 text-brand-green hover:bg-brand-green/30 px-6 py-2 rounded-xl font-medium transition-all"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Skip */}
          {!isLast && (
            <div className="text-center mt-4">
              <button
                onClick={handleComplete}
                className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Skip walkthrough
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
