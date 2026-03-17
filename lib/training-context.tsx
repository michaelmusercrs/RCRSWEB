'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

// Module name lookup for server persistence
const MODULE_NAMES: Record<string, string> = {
  'portal-overview': 'Portal Overview',
  'admin-blog': 'Blog Management',
  'admin-team': 'Team Management',
  'admin-images': 'Image Gallery',
  'inventory': 'Inventory Management',
  'manager': 'Manager Dashboard',
  'driver': 'Driver Portal',
  // Onboarding quizzes (from /portal/quizzes)
  'quiz_sales-rep': 'Sales Rep Knowledge Check',
  'quiz_operations': 'Operations Knowledge Check',
  'quiz_company': 'Company Knowledge Check',
};

// User roles and their required training modules
export const USER_ROLES = {
  admin: 'Admin',
  manager: 'Manager',
  office: 'Office Staff',
  warehouse: 'Warehouse',
  driver: 'Driver',
  pm: 'Project Manager',
  sales: 'Sales Rep',
} as const;

export type UserRole = keyof typeof USER_ROLES;

// Training modules per role (admin-training track only — these are tracked in the gamified Academy)
// Sales & onboarding tracks are tracked separately via their own pages/APIs
export const ROLE_TRAINING_MODULES: Record<UserRole, string[]> = {
  admin: ['portal-overview', 'admin-blog', 'admin-team', 'admin-images', 'inventory', 'manager', 'driver'],
  manager: ['portal-overview', 'inventory', 'manager', 'driver'],
  office: ['portal-overview', 'manager'],
  warehouse: ['portal-overview', 'inventory'],
  driver: ['portal-overview', 'driver'],
  pm: ['portal-overview', 'manager'],
  sales: ['portal-overview'],
};

// Points configuration
export const POINTS_CONFIG = {
  lessonComplete: 10,
  moduleComplete: 50,
  allTrainingComplete: 200,
  dailyLogin: 5,
  streakBonus: 25, // 7 day streak
};

interface TrainingProgress {
  completedLessons: string[];
  completedModules: string[];
  points: number;
  streak: number;
  lastLoginDate: string;
  dontShowPopup: boolean;
  allTrainingComplete: boolean;
}

interface UserSettings {
  theme: 'dark' | 'light' | 'system';
  profileImage: string;
  displayName: string;
  email: string;
  role: UserRole;
  notifications: {
    training: boolean;
    deliveries: boolean;
    inventory: boolean;
  };
}

interface LeaderboardEntry {
  name: string;
  role: UserRole;
  points: number;
  completedModules: number;
  streak: number;
  avatar?: string;
}

interface TrainingContextType {
  // Training progress
  progress: TrainingProgress;
  markLessonComplete: (lessonId: string) => void;
  markModuleComplete: (moduleId: string) => void;
  getModuleProgress: (moduleId: string) => number;

  // User settings
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;

  // Popup control
  showTrainingPopup: boolean;
  setShowTrainingPopup: (show: boolean) => void;
  dismissPopup: (dontShowAgain: boolean) => void;

  // Leaderboard
  leaderboard: LeaderboardEntry[];
  userRank: number;

  // Theme
  currentTheme: 'dark' | 'light';
}

const defaultProgress: TrainingProgress = {
  completedLessons: [],
  completedModules: [],
  points: 0,
  streak: 0,
  lastLoginDate: '',
  dontShowPopup: false,
  allTrainingComplete: false,
};

const defaultSettings: UserSettings = {
  theme: 'dark',
  profileImage: '',
  displayName: 'User',
  email: '',
  role: 'office',
  notifications: {
    training: true,
    deliveries: true,
    inventory: true,
  },
};

// Initial leaderboard - team members start with zero points
// Points will be earned through actual training completion
const initialLeaderboard: LeaderboardEntry[] = [
  { name: 'Chris Muse', role: 'admin', points: 0, completedModules: 0, streak: 0 },
  { name: 'Michael Muse', role: 'admin', points: 0, completedModules: 0, streak: 0 },
  { name: 'Sara Hill', role: 'admin', points: 0, completedModules: 0, streak: 0 },
  { name: 'Destin McCury', role: 'office', points: 0, completedModules: 0, streak: 0 },
  { name: 'Tia Morris', role: 'office', points: 0, completedModules: 0, streak: 0 },
  { name: 'Bart Roberts', role: 'pm', points: 0, completedModules: 0, streak: 0 },
  { name: 'John Cordonis', role: 'pm', points: 0, completedModules: 0, streak: 0 },
  { name: 'Richard Geahr', role: 'driver', points: 0, completedModules: 0, streak: 0 },
  { name: 'Tae Orr', role: 'driver', points: 0, completedModules: 0, streak: 0 },
];

const TrainingContext = createContext<TrainingContextType | undefined>(undefined);

/**
 * Persist a module completion to the server via /api/portal/training.
 * Fire-and-forget: errors are logged but do not block the UI.
 */
async function persistModuleToServer(
  userId: string,
  userName: string,
  moduleId: string,
): Promise<void> {
  try {
    await fetch('/api/portal/training', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userName,
        moduleId,
        moduleName: MODULE_NAMES[moduleId] || moduleId,
        score: '100',
        passed: true,
        completedAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn('Failed to persist training completion to server:', err);
  }
}

/**
 * Fetch persisted training progress from the server for a given user.
 * Returns an array of completed module IDs.
 */
async function fetchServerProgress(userId: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/portal/training?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.success && Array.isArray(data.completedModules)) {
      return data.completedModules as string[];
    }
    return [];
  } catch {
    // Server may not be available (e.g. offline, or Sheets not configured)
    return [];
  }
}

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<TrainingProgress>(defaultProgress);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [showTrainingPopup, setShowTrainingPopup] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');
  const serverSyncDone = useRef(false);

  // Load from localStorage on mount, then merge with server data
  useEffect(() => {
    const savedProgress = localStorage.getItem('rcrs-training-progress');
    const savedSettings = localStorage.getItem('rcrs-user-settings');

    let localProgress: TrainingProgress = defaultProgress;
    let localSettings: UserSettings = defaultSettings;

    if (savedProgress) {
      localProgress = JSON.parse(savedProgress);
      setProgress(localProgress);
    }

    if (savedSettings) {
      localSettings = JSON.parse(savedSettings);
      setSettings(localSettings);

      // Apply theme
      if (localSettings.theme === 'light') {
        setCurrentTheme('light');
        document.documentElement.classList.add('light-mode');
      } else if (localSettings.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setCurrentTheme(prefersDark ? 'dark' : 'light');
        if (!prefersDark) document.documentElement.classList.add('light-mode');
      }
    }

    // Check if should show training popup
    const today = new Date().toISOString().split('T')[0];
    if (savedProgress) {
      const parsed = localProgress;
      if (!parsed.dontShowPopup && !parsed.allTrainingComplete) {
        const requiredModules = ROLE_TRAINING_MODULES[localSettings.role] || [];
        const allComplete = requiredModules.every(m => parsed.completedModules.includes(m));
        if (!allComplete) {
          setShowTrainingPopup(true);
        }
      }

      // Update streak
      if (parsed.lastLoginDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = parsed.streak || 0;
        let bonusPoints = POINTS_CONFIG.dailyLogin;

        if (parsed.lastLoginDate === yesterdayStr) {
          newStreak += 1;
          if (newStreak % 7 === 0) {
            bonusPoints += POINTS_CONFIG.streakBonus;
          }
        } else if (parsed.lastLoginDate !== today) {
          newStreak = 1;
        }

        setProgress(prev => ({
          ...prev,
          streak: newStreak,
          lastLoginDate: today,
          points: prev.points + bonusPoints,
        }));
      }
    } else {
      setShowTrainingPopup(true);
    }

    // Fetch server-side progress and merge with local state
    const userId = localSettings.email || localSettings.displayName || 'anonymous';
    fetchServerProgress(userId).then(serverModules => {
      if (serverModules.length > 0) {
        setProgress(prev => {
          const mergedModules = Array.from(
            new Set([...prev.completedModules, ...serverModules])
          );
          // Only update if server had modules not in local state
          if (mergedModules.length > prev.completedModules.length) {
            const newModulesCount = mergedModules.length - prev.completedModules.length;
            return {
              ...prev,
              completedModules: mergedModules,
              points: prev.points + (newModulesCount * POINTS_CONFIG.moduleComplete),
            };
          }
          return prev;
        });
      }
      serverSyncDone.current = true;
    });
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    if (progress !== defaultProgress) {
      localStorage.setItem('rcrs-training-progress', JSON.stringify(progress));
    }
  }, [progress]);

  // Save settings to localStorage
  useEffect(() => {
    if (settings !== defaultSettings) {
      localStorage.setItem('rcrs-user-settings', JSON.stringify(settings));
    }
  }, [settings]);

  const markLessonComplete = useCallback((lessonId: string) => {
    setProgress(prev => {
      if (prev.completedLessons.includes(lessonId)) return prev;
      return {
        ...prev,
        completedLessons: [...prev.completedLessons, lessonId],
        points: prev.points + POINTS_CONFIG.lessonComplete,
      };
    });
  }, []);

  const markModuleComplete = useCallback((moduleId: string) => {
    setProgress(prev => {
      if (prev.completedModules.includes(moduleId)) return prev;

      const requiredModules = ROLE_TRAINING_MODULES[settings.role] || [];
      const newCompletedModules = [...prev.completedModules, moduleId];
      const allComplete = requiredModules.every(m => newCompletedModules.includes(m));

      let bonusPoints = POINTS_CONFIG.moduleComplete;
      if (allComplete && !prev.allTrainingComplete) {
        bonusPoints += POINTS_CONFIG.allTrainingComplete;
      }

      return {
        ...prev,
        completedModules: newCompletedModules,
        points: prev.points + bonusPoints,
        allTrainingComplete: allComplete,
      };
    });

    // Persist to server (fire and forget)
    const userId = settings.email || settings.displayName || 'anonymous';
    const userName = settings.displayName || 'User';
    persistModuleToServer(userId, userName, moduleId);
  }, [settings.role, settings.email, settings.displayName]);

  const getModuleProgress = useCallback((moduleId: string): number => {
    const moduleLessonCounts: Record<string, number> = {
      'portal-overview': 4,
      'admin-blog': 4,
      'admin-team': 4,
      'admin-images': 3,
      'inventory': 4,
      'manager': 5,
      'driver': 5,
    };

    const totalLessons = moduleLessonCounts[moduleId] || 4;
    const completedInModule = progress.completedLessons.filter(l =>
      l.startsWith(moduleId.replace('admin-', ''))
    ).length;

    return Math.round((completedInModule / totalLessons) * 100);
  }, [progress.completedLessons]);

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };

      // Apply theme changes immediately
      if (updates.theme) {
        if (updates.theme === 'light') {
          document.documentElement.classList.add('light-mode');
          setCurrentTheme('light');
        } else if (updates.theme === 'dark') {
          document.documentElement.classList.remove('light-mode');
          setCurrentTheme('dark');
        } else {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            document.documentElement.classList.remove('light-mode');
            setCurrentTheme('dark');
          } else {
            document.documentElement.classList.add('light-mode');
            setCurrentTheme('light');
          }
        }
      }

      return newSettings;
    });
  }, []);

  const dismissPopup = useCallback((dontShowAgain: boolean) => {
    setShowTrainingPopup(false);
    if (dontShowAgain) {
      setProgress(prev => ({ ...prev, dontShowPopup: true }));
    }
  }, []);

  // Calculate user rank
  const userRank = leaderboard.findIndex(e => e.name === settings.displayName) + 1 || leaderboard.length + 1;

  return (
    <TrainingContext.Provider value={{
      progress,
      markLessonComplete,
      markModuleComplete,
      getModuleProgress,
      settings,
      updateSettings,
      showTrainingPopup,
      setShowTrainingPopup,
      dismissPopup,
      leaderboard,
      userRank,
      currentTheme,
    }}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const context = useContext(TrainingContext);
  if (!context) {
    throw new Error('useTraining must be used within a TrainingProvider');
  }
  return context;
}
