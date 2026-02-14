'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Command,
  GraduationCap,
  BookOpen,
  Brain,
  CreditCard,
  Clock,
  CheckCircle2,
  ChevronRight,
  Lock,
  Monitor,
  Users,
  MapPin,
  Ruler,
  BarChart3,
  MessageSquare,
  Shield,
  Calendar,
  Target,
  LayoutDashboard,
  DollarSign,
  Package,
  FileSpreadsheet,
  Zap,
  Truck,
  Map,
  RotateCcw,
  AlertTriangle,
  Building2,
  TrendingUp,
  Globe,
  Home,
  CloudRain,
  HelpCircle,
  HardHat,
  ClipboardList,
  CheckCircle,
  Settings,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';
import {
  ALL_TRAINING_MODULES,
  TRAINING_ROLES,
  getModulesForTrainingRole,
  groupModulesByCategory,
  type TrainingModuleDef,
  type TrainingRole,
  type TrainingModuleStatus,
} from '@/lib/training-modules';

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Monitor,
  Users,
  MapPin,
  Ruler,
  BarChart3,
  MessageSquare,
  Shield,
  Calendar,
  Brain,
  CreditCard,
  Target,
  LayoutDashboard,
  DollarSign,
  Package,
  FileSpreadsheet,
  Zap,
  Truck,
  Map,
  RotateCcw,
  AlertTriangle,
  Building2,
  TrendingUp,
  Globe,
  Home,
  CloudRain,
  HelpCircle,
  HardHat,
  ClipboardList,
  CheckCircle,
  Settings,
  BookOpen,
  GraduationCap,
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: TrainingModuleStatus }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-green/10 text-brand-green border border-brand-green/20">
        <CheckCircle2 size={10} />
        Ready
      </span>
    );
  }
  if (status === 'coming-soon') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock size={10} />
        Coming Soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-neutral-400 border border-white/10">
      <Lock size={10} />
      Draft
    </span>
  );
}

// ---------------------------------------------------------------------------
// Module card
// ---------------------------------------------------------------------------

function ModuleCard({ module }: { module: TrainingModuleDef }) {
  const Icon = ICON_MAP[module.icon || 'BookOpen'] || BookOpen;
  const isAvailable = module.status === 'ready';

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isAvailable
          ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
          : 'border-white/5 bg-white/[0.01] opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-neutral-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-white leading-tight">
              {module.title}
            </h4>
            <StatusBadge status={module.status} />
          </div>
          <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
            {module.description}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-500">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {module.estimatedMinutes} min
            </span>
            {module.contentType === 'quiz' && module.itemCount && (
              <span className="flex items-center gap-1">
                <Brain size={10} />
                {module.itemCount} questions
              </span>
            )}
            {module.contentType === 'flashcards' && module.itemCount && (
              <span className="flex items-center gap-1">
                <CreditCard size={10} />
                {module.itemCount} terms
              </span>
            )}
            {module.contentType === 'lesson' && (
              <span className="flex items-center gap-1">
                <BookOpen size={10} />
                Lesson
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TrainingModulesPage() {
  const [activeRole, setActiveRole] = useState<TrainingRole>('sales_rep');
  const [userRole, setUserRole] = useState<string>('');

  // Try to detect the user's role from settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rcrs-user-settings');
      if (raw) {
        const settings = JSON.parse(raw);
        const role = settings.role || '';
        setUserRole(role);
        // Auto-select their role tab
        const roleMap: Record<string, TrainingRole> = {
          sales_rep: 'sales_rep',
          admin: 'admin',
          office_staff: 'admin',
          driver: 'driver',
          owner: 'owner',
          manager: 'owner',
        };
        if (roleMap[role]) {
          setActiveRole(roleMap[role]);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const roleModules = getModulesForTrainingRole(activeRole);
  const grouped = groupModulesByCategory(roleModules);
  const roleMeta = TRAINING_ROLES.find((r) => r.role === activeRole);
  const totalMinutes = roleModules.reduce((sum, m) => sum + m.estimatedMinutes, 0);
  const readyCount = roleModules.filter((m) => m.status === 'ready').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background */}
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
                  href="/portal/training"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Training Modules
                  </h1>
                  <p className="text-sm text-neutral-400">
                    Role-based training for every position
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
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* Role Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {TRAINING_ROLES.map((role) => {
              const isActive = activeRole === role.role;
              const count = getModulesForTrainingRole(role.role).length;
              return (
                <button
                  key={role.role}
                  onClick={() => setActiveRole(role.role)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    isActive
                      ? `bg-gradient-to-r ${role.color} ${role.borderColor} text-white`
                      : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {role.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-neutral-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Role Summary */}
          {roleMeta && (
            <div
              className={`rounded-2xl border ${roleMeta.borderColor} bg-gradient-to-r ${roleMeta.color} p-6 mb-8`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{roleMeta.label} Training</h2>
                  <p className="text-sm text-neutral-300 mt-1">{roleMeta.description}</p>
                </div>
                <div className="flex items-center gap-6 text-sm text-neutral-300">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{roleModules.length}</p>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Modules</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{readyCount}</p>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Ready</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">
                      {totalMinutes >= 60
                        ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                        : `${totalMinutes}m`}
                    </p>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Est. Time</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grouped Modules */}
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, modules]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                  {category}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {modules.map((mod) => (
                    <ModuleCard key={mod.id} module={mod} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* All Roles Overview */}
          <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">All Training Paths</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TRAINING_ROLES.map((role) => {
                const mods = getModulesForTrainingRole(role.role);
                const mins = mods.reduce((s, m) => s + m.estimatedMinutes, 0);
                return (
                  <button
                    key={role.role}
                    onClick={() => setActiveRole(role.role)}
                    className={`text-left rounded-xl border ${role.borderColor} bg-gradient-to-br ${role.color} p-4 hover:scale-[1.02] transition-all`}
                  >
                    <h4 className="text-sm font-semibold text-white">{role.label}</h4>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-1">
                      {role.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-500">
                      <span>{mods.length} modules</span>
                      <span>
                        {mins >= 60
                          ? `${Math.floor(mins / 60)}h ${mins % 60}m`
                          : `${mins}m`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
