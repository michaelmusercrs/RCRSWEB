'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// Training modules per role
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

// Leaderboard data - reset to zero for all team members
// Points will be earned through actual training completion
const mockLeaderboard: LeaderboardEntry[] = [
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

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<TrainingProgress>(defaultProgress);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [showTrainingPopup, setShowTrainingPopup] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(mockLeaderboard);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');

  // Load from localStorage on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem('rcrs-training-progress');
    const savedSettings = localStorage.getItem('rcrs-user-settings');

    if (savedProgress) {
      const parsed = JSON.parse(savedProgress);
      setProgress(parsed);
    }

    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);

      // Apply theme
      if (parsed.theme === 'light') {
        setCurrentTheme('light');
        document.documentElement.classList.add('light-mode');
      } else if (parsed.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setCurrentTheme(prefersDark ? 'dark' : 'light');
        if (!prefersDark) document.documentElement.classList.add('light-mode');
      }
    }

    // Check if should show training popup
    const today = new Date().toISOString().split('T')[0];
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress);
      if (!parsed.dontShowPopup && !parsed.allTrainingComplete) {
        // Check if all required training is complete
        const requiredModules = ROLE_TRAINING_MODULES[settings.role] || [];
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

  const markLessonComplete = (lessonId: string) => {
    if (!progress.completedLessons.includes(lessonId)) {
      setProgress(prev => ({
        ...prev,
        completedLessons: [...prev.completedLessons, lessonId],
        points: prev.points + POINTS_CONFIG.lessonComplete,
      }));
    }
  };

  const markModuleComplete = (moduleId: string) => {
    if (!progress.completedModules.includes(moduleId)) {
      const requiredModules = ROLE_TRAINING_MODULES[settings.role] || [];
      const newCompletedModules = [...progress.completedModules, moduleId];
      const allComplete = requiredModules.every(m => newCompletedModules.includes(m));

      let bonusPoints = POINTS_CONFIG.moduleComplete;
      if (allComplete && !progress.allTrainingComplete) {
        bonusPoints += POINTS_CONFIG.allTrainingComplete;
      }

      setProgress(prev => ({
        ...prev,
        completedModules: newCompletedModules,
        points: prev.points + bonusPoints,
        allTrainingComplete: allComplete,
      }));
    }
  };

  const getModuleProgress = (moduleId: string): number => {
    // This would need actual lesson counts per module
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
  };

  const updateSettings = (updates: Partial<UserSettings>) => {
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
  };

  const dismissPopup = (dontShowAgain: boolean) => {
    setShowTrainingPopup(false);
    if (dontShowAgain) {
      setProgress(prev => ({ ...prev, dontShowPopup: true }));
    }
  };

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
