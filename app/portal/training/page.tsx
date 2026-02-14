'use client';

import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  Monitor,
  Trophy,
  ArrowRight,
  ArrowLeft,
  Home,
  Users,
  UserCircle,
  Target,
  Zap,
  Command,
  Brain,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';

const trainingPaths = [
  {
    title: 'Training Library',
    subtitle: 'AI-Powered Deep Dives & Media',
    description:
      'AI-generated training content powered by NotebookLM. Includes RoofStack Radio audio deep dives, RoofStack TV videos, interactive quizzes, flashcards, System Maps, Visual Guides, and study guides for every role.',
    href: '/portal/training/library',
    icon: GraduationCap,
    color: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/30',
    iconColor: 'text-purple-400',
    modules: 5,
    estimatedTime: '10+ hours',
    audience: 'All Roles',
  },
  {
    title: 'NotebookLM Guide',
    subtitle: 'AI Research Tool Training',
    description:
      'Learn how to use Google NotebookLM to supercharge your productivity. Covers adding sources, AI chat, audio overviews, sharing, and using RoofStack sales data notebooks for territory prep and meeting analysis.',
    href: '/portal/training/notebooklm',
    icon: Brain,
    color: 'from-violet-500/20 to-purple-500/20',
    borderColor: 'border-violet-500/30',
    iconColor: 'text-violet-400',
    modules: 8,
    estimatedTime: '1-2 hours',
    audience: 'All Team Members',
  },
  {
    title: 'Sales Training',
    subtitle: 'New Hire Roofing Sales Program',
    description:
      'Complete training program for new sales hires. Learn about roofing products, the insurance claim process, the RoofStack sales methodology, CRM usage, measurement, and customer communication.',
    href: '/portal/training/sales',
    icon: Target,
    color: 'from-brand-green/20 to-emerald-500/20',
    borderColor: 'border-brand-green/30',
    iconColor: 'text-brand-green',
    modules: 7,
    estimatedTime: '4-6 hours',
    audience: 'New Sales Hires',
  },
  {
    title: 'Platform Onboarding',
    subtitle: 'Learn the RoofStack Interface',
    description:
      'Step-by-step walkthrough of the RoofStack platform. Learn how to navigate HQ, manage leads, handle deliveries, create invoices, schedule appointments, and more.',
    href: '/portal/training/onboarding',
    icon: Monitor,
    color: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    modules: 8,
    estimatedTime: '2-3 hours',
    audience: 'All Team Members',
  },
  {
    title: 'Role-Based Modules',
    subtitle: 'Training by Position',
    description:
      'Structured training modules organized by role: Sales Rep (10), Admin (11), Driver (8), Owner/Manager (8), Customer-Facing (5), and Production Crew (3). Each module includes lessons, quizzes, and flashcards.',
    href: '/portal/training/modules',
    icon: Trophy,
    color: 'from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    modules: 45,
    estimatedTime: '20+ hours',
    audience: 'All Roles',
  },
  {
    title: 'Personal Walkthroughs',
    subtitle: 'Tailored to Your Role',
    description:
      'Individualized walkthroughs for every team member. See only the features you use daily, with "Try It" links to jump straight into each tool.',
    href: '/portal/training/walkthrough',
    icon: UserCircle,
    color: 'from-brand-green/20 to-teal-500/20',
    borderColor: 'border-brand-green/30',
    iconColor: 'text-brand-green',
    modules: 8,
    estimatedTime: '30-60 min',
    audience: 'By Name',
  },
];

export default function TrainingHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/admin"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Academy
                  </h1>
                  <p className="text-sm text-neutral-400">
                    Choose a training program to get started
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/command-center"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all"
                >
                  <Command size={16} />
                  RoofStack HQ
                </Link>
                <Link
                  href="/"
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <Home size={16} />
                  View Site
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/20 flex items-center justify-center">
              <GraduationCap size={32} className="text-brand-green" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              RoofStack Academy
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Whether you are a new sales hire learning the ropes, a team member getting
              familiar with the platform, or looking to level up with RoofStack Academy
              -- we have a program for you.
            </p>
          </div>

          {/* Training Path Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {trainingPaths.map((path) => {
              const Icon = path.icon;
              return (
                <Link
                  key={path.href}
                  href={path.href}
                  className={`group block rounded-2xl border ${path.borderColor} bg-gradient-to-br ${path.color} p-6 hover:scale-[1.02] transition-all duration-200`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center`}>
                      <Icon size={24} className={path.iconColor} />
                    </div>
                    <ArrowRight
                      size={20}
                      className="text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all"
                    />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{path.title}</h3>
                  <p className="text-sm text-neutral-300 mb-3">{path.subtitle}</p>
                  <p className="text-sm text-neutral-400 mb-4 line-clamp-3">
                    {path.description}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      {path.modules} modules
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap size={12} />
                      {path.estimatedTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {path.audience}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick Info */}
          <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              How Training Works
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Choose a Program</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Select the training path that matches your role and goals.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Complete Modules</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Work through each module at your own pace. Pass quizzes to advance.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Get Certified</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Complete all modules to earn your certificate of completion.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
