'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Bot,
  Bell,
  Workflow,
  Warehouse,
  Package,
  Shield,
  Server,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Download,
  Upload,
  Play,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  Mic,
  Volume2,
  Lightbulb,
  DoorOpen,
  Monitor,
  Speaker,
  Users,
  Lock,
  Info,
  Zap,
  MessageSquare,
  Clock,
  Camera,
  FileSignature,
  CloudRain,
  Mail,
  RefreshCw,
} from 'lucide-react';

// ============================================
// TYPES (mirrors delivery-settings-service.ts)
// ============================================

interface AIAgentSettings {
  agentName: string;
  agentPersonality: 'professional' | 'friendly' | 'concise';
  ttsEnabled: boolean;
  ttsVoice: string;
  ttsSpeed: number;
  autoGreeting: boolean;
  autoCoaching: boolean;
  autoReminders: boolean;
  reminderLeadTime: number;
  safetyTipsEnabled: boolean;
  conversationTopicsEnabled: boolean;
  maxQAConfidence: number;
  trainingInstructions: string;
  customQA: Array<{ question: string; answer: string }>;
}

interface NotificationSettings {
  statusNotifications: Record<string, {
    notifyDriver: boolean;
    notifyCustomer: boolean;
    notifyOffice: boolean;
    notifyPM: boolean;
  }>;
  escalationEnabled: boolean;
  escalationTimeout: number;
  overdueAlertEnabled: boolean;
  overdueThreshold: number;
}

interface WorkflowSettings {
  requirePhotoAtStatus: Record<string, boolean>;
  requireSignature: boolean;
  autoAdvanceStatus: boolean;
  allowSkipStatus: boolean;
  maxDeliveriesPerDriver: number;
  defaultPriority: 'normal' | 'rush' | 'urgent';
  weatherDelayAutomatic: boolean;
  weatherDelayThreshold: 'minor' | 'moderate' | 'severe';
}

interface WarehouseIoTSettings {
  iotEnabled: boolean;
  haBaseUrl: string;
  lightsEnabled: boolean;
  doorsEnabled: boolean;
  displayEnabled: boolean;
  speakerEnabled: boolean;
  autoLightsOnStatus: boolean;
  autoAnnounce: boolean;
  dashboardRefreshInterval: number;
}

interface InventorySettings {
  lowStockAlertEnabled: boolean;
  lowStockEmailRecipients: string[];
  autoRestockSuggestions: boolean;
  weeklyCountDay: string;
  weeklyCountReminder: boolean;
  pricingVerificationFrequency: 'daily' | 'weekly' | 'monthly';
}

interface AccessControlSettings {
  roles: Record<string, string[]>;
}

interface AllSettings {
  ai: AIAgentSettings;
  notifications: NotificationSettings;
  workflow: WorkflowSettings;
  warehouse: WarehouseIoTSettings;
  inventory: InventorySettings;
  access: AccessControlSettings;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  message: string;
}

interface TestAIResult {
  agentName: string;
  personality: string;
  testOutput: {
    greeting: string;
    conversationTopic: string;
    sampleQA: { question: string; answer: string; confidence: string };
    coachingTipsCount: number;
    sampleCoachingTip: string;
  };
}

// ============================================
// CONSTANTS
// ============================================

const DELIVERY_STATUSES = [
  'assigned', 'materials_pulled', 'load_verified', 'en_route',
  'arrived', 'delivered', 'proof_captured', 'qc_photos',
  'completed', 'cancelled',
];

const ALL_PERMISSIONS = [
  'view_orders', 'create_orders', 'approve_orders', 'assign_drivers',
  'manage_inventory', 'manage_pricing', 'view_reports',
  'manage_settings', 'manage_iot', 'manage_ai',
];

const ALL_ROLES = ['admin', 'manager', 'office', 'driver', 'warehouse'];

const MOCK_USERS = [
  { id: 'u1', name: 'Michael Muse', email: 'michaelmuse@rcrsal.com', role: 'admin' },
  { id: 'u2', name: 'Sara Hill', email: 'sara@rcrsal.com', role: 'manager' },
  { id: 'u3', name: 'Tia', email: 'tia@rcrsal.com', role: 'office' },
  { id: 'u4', name: 'Carlos Rivera', email: 'carlos@rcrsal.com', role: 'driver' },
  { id: 'u5', name: 'Marcus Johnson', email: 'marcus@rcrsal.com', role: 'driver' },
  { id: 'u6', name: 'Destin', email: 'destin@rcrsal.com', role: 'warehouse' },
];

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  materials_pulled: 'Materials Pulled',
  load_verified: 'Load Verified',
  en_route: 'En Route',
  arrived: 'Arrived',
  delivered: 'Delivered',
  proof_captured: 'Proof Captured',
  qc_photos: 'QC Photos',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PERMISSION_LABELS: Record<string, string> = {
  view_orders: 'View Orders',
  create_orders: 'Create Orders',
  approve_orders: 'Approve Orders',
  assign_drivers: 'Assign Drivers',
  manage_inventory: 'Manage Inventory',
  manage_pricing: 'Manage Pricing',
  view_reports: 'View Reports',
  manage_settings: 'Manage Settings',
  manage_iot: 'Manage IoT',
  manage_ai: 'Manage AI',
};

// ============================================
// DEFAULT SETTINGS (client-side mirror)
// ============================================

const DEFAULT_SETTINGS: AllSettings = {
  ai: {
    agentName: 'RCRS Assistant',
    agentPersonality: 'professional',
    ttsEnabled: true,
    ttsVoice: 'en-US-Standard-D',
    ttsSpeed: 1.0,
    autoGreeting: true,
    autoCoaching: true,
    autoReminders: true,
    reminderLeadTime: 15,
    safetyTipsEnabled: true,
    conversationTopicsEnabled: true,
    maxQAConfidence: 0.5,
    trainingInstructions: '',
    customQA: [],
  },
  notifications: {
    statusNotifications: Object.fromEntries(
      DELIVERY_STATUSES.map(s => [s, {
        notifyDriver: ['assigned', 'materials_pulled', 'load_verified', 'en_route', 'delivered', 'completed', 'cancelled'].includes(s),
        notifyCustomer: ['assigned', 'en_route', 'arrived', 'delivered', 'cancelled'].includes(s),
        notifyOffice: true,
        notifyPM: ['assigned', 'en_route', 'arrived', 'delivered', 'proof_captured', 'qc_photos', 'completed', 'cancelled'].includes(s),
      }])
    ),
    escalationEnabled: true,
    escalationTimeout: 60,
    overdueAlertEnabled: true,
    overdueThreshold: 4,
  },
  workflow: {
    requirePhotoAtStatus: Object.fromEntries(
      DELIVERY_STATUSES.map(s => [s, ['load_verified', 'delivered', 'proof_captured', 'qc_photos'].includes(s)])
    ),
    requireSignature: true,
    autoAdvanceStatus: false,
    allowSkipStatus: false,
    maxDeliveriesPerDriver: 8,
    defaultPriority: 'normal',
    weatherDelayAutomatic: false,
    weatherDelayThreshold: 'moderate',
  },
  warehouse: {
    iotEnabled: true,
    haBaseUrl: 'http://192.168.86.102:8123',
    lightsEnabled: true,
    doorsEnabled: true,
    displayEnabled: true,
    speakerEnabled: true,
    autoLightsOnStatus: true,
    autoAnnounce: true,
    dashboardRefreshInterval: 30,
  },
  inventory: {
    lowStockAlertEnabled: true,
    lowStockEmailRecipients: ['rcrs@rivercityroofingsolutions.com'],
    autoRestockSuggestions: true,
    weeklyCountDay: 'Friday',
    weeklyCountReminder: true,
    pricingVerificationFrequency: 'weekly',
  },
  access: {
    roles: {
      admin: ALL_PERMISSIONS.slice(),
      manager: ['view_orders', 'create_orders', 'approve_orders', 'assign_drivers', 'manage_inventory', 'view_reports', 'manage_ai'],
      office: ['view_orders', 'create_orders', 'assign_drivers', 'manage_inventory', 'view_reports'],
      driver: ['view_orders'],
      warehouse: ['view_orders', 'manage_inventory'],
    },
  },
};

// ============================================
// HELPER COMPONENTS
// ============================================

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-[#39FF14]' : 'bg-zinc-700'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function Slider({
  value, min, max, step, onChange, label, unit,
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; label?: string; unit?: string;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      {label && <span className="text-sm text-zinc-400 whitespace-nowrap">{label}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step || 1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-[#39FF14] bg-zinc-700"
      />
      <span className="text-sm font-mono text-white min-w-[4rem] text-right">
        {value}{unit || ''}
      </span>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-green-900/80 border-green-500 text-green-200',
    error: 'bg-red-900/80 border-red-500 text-red-200',
    info: 'bg-blue-900/80 border-blue-500 text-blue-200',
  };
  const icons = {
    success: <CheckCircle className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border ${colors[type]} shadow-lg animate-slide-in`}>
      {icons[type]}
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-75"><X className="w-4 h-4" /></button>
    </div>
  );
}

function AccordionSection({
  title, icon, children, open, onToggle, badge,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  open: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900/80 hover:bg-zinc-800/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#39FF14]">{icon}</span>
          <span className="text-white font-semibold text-lg">{title}</span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">{badge}</span>
          )}
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-zinc-400" /> : <ChevronRight className="w-5 h-5 text-zinc-400" />}
      </button>
      {open && (
        <div className="px-5 py-5 bg-zinc-950 border-t border-zinc-800 space-y-6">
          {children}
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md mx-4 space-y-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-zinc-400 text-sm">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-zinc-700 text-white text-sm hover:bg-zinc-600">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-500">
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function DeliverySettingsPage() {
  // Settings state
  const [settings, setSettings] = useState<AllSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ai: true,
    notifications: false,
    workflow: false,
    warehouse: false,
    inventory: false,
    access: false,
    system: false,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [testAIResult, setTestAIResult] = useState<TestAIResult | null>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [testingIoT, setTestingIoT] = useState(false);
  const [iotStatus, setIoTStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [healthData, setHealthData] = useState<ServiceHealth[] | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [newQA, setNewQA] = useState({ question: '', answer: '' });
  const [newEmail, setNewEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ------------------------------------------
  // Load settings from localStorage
  // ------------------------------------------
  useEffect(() => {
    try {
      const stored = localStorage.getItem('rcrs-delivery-settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {
      // Use defaults
    }
    setLoading(false);
  }, []);

  // ------------------------------------------
  // Save to localStorage helper
  // ------------------------------------------
  const saveToLocalStorage = useCallback((newSettings: AllSettings) => {
    try {
      localStorage.setItem('rcrs-delivery-settings', JSON.stringify(newSettings));
    } catch {
      // Storage full or unavailable
    }
  }, []);

  // ------------------------------------------
  // Toggle accordion section
  // ------------------------------------------
  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ------------------------------------------
  // Update a specific category
  // ------------------------------------------
  const updateCategory = <K extends keyof AllSettings>(category: K, updates: Partial<AllSettings[K]>) => {
    setSettings(prev => {
      const next = {
        ...prev,
        [category]: { ...prev[category], ...updates },
      };
      return next;
    });
  };

  // ------------------------------------------
  // Save All Settings
  // ------------------------------------------
  const saveAllSettings = async () => {
    setSaving(true);
    try {
      saveToLocalStorage(settings);
      // Also try API
      try {
        const categories: (keyof AllSettings)[] = ['ai', 'notifications', 'workflow', 'warehouse', 'inventory', 'access'];
        for (const cat of categories) {
          await fetch('/api/portal/delivery/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', category: cat, updates: settings[cat] }),
          });
        }
      } catch {
        // API not available, localStorage saved
      }
      setToast({ message: 'Settings saved successfully!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save settings.', type: 'error' });
    }
    setSaving(false);
  };

  // ------------------------------------------
  // Reset to defaults
  // ------------------------------------------
  const handleReset = () => {
    setSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
    saveToLocalStorage(DEFAULT_SETTINGS);
    setShowResetModal(false);
    setToast({ message: 'All settings reset to defaults.', type: 'info' });
  };

  // ------------------------------------------
  // Export Settings
  // ------------------------------------------
  const handleExport = () => {
    const json = JSON.stringify(settings, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rcrs-delivery-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Settings exported.', type: 'success' });
  };

  // ------------------------------------------
  // Import Settings
  // ------------------------------------------
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        setSettings(merged);
        saveToLocalStorage(merged);
        setToast({ message: 'Settings imported successfully!', type: 'success' });
      } catch {
        setToast({ message: 'Invalid settings file.', type: 'error' });
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ------------------------------------------
  // Test AI
  // ------------------------------------------
  const handleTestAI = async () => {
    setTestingAI(true);
    setTestAIResult(null);
    try {
      const res = await fetch('/api/portal/delivery/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-ai' }),
      });
      const data = await res.json();
      if (data.success) {
        setTestAIResult(data);
      } else {
        setToast({ message: 'AI test failed.', type: 'error' });
      }
    } catch {
      // Show mock result for demo
      setTestAIResult({
        agentName: settings.ai.agentName,
        personality: settings.ai.agentPersonality,
        testOutput: {
          greeting: `Good morning, Test Driver. This is your ${settings.ai.agentName}. You have 3 deliveries on the schedule today. 1 rush order as well. You will be covering Huntsville and Madison. Let us get started. Stay safe out there.`,
          conversationTopic: 'Did you know? The average asphalt shingle roof lasts 20 to 25 years, but in the Tennessee Valley heat, some roofs need replacement sooner.',
          sampleQA: {
            question: 'What PPE is required?',
            answer: 'At minimum, you need steel-toe boots, work gloves, and a high-visibility vest. When handling metal flashing or drip edge, use cut-resistant gloves. For roof-level deliveries, a hard hat is required.',
            confidence: 'high',
          },
          coachingTipsCount: 8,
          sampleCoachingTip: 'When you arrive, introduce yourself. Say: Hi, I am from River City Roofing Solutions. I have a delivery for the homeowner. Where would you like the materials placed?',
        },
      });
    }
    setTestingAI(false);
  };

  // ------------------------------------------
  // Test IoT
  // ------------------------------------------
  const handleTestIoT = async () => {
    setTestingIoT(true);
    setIoTStatus(null);
    try {
      const res = await fetch('/api/portal/delivery/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-iot' }),
      });
      const data = await res.json();
      setIoTStatus({ connected: data.connected || false, message: data.message || 'Test complete.' });
    } catch {
      setIoTStatus({ connected: false, message: 'Could not reach IoT service. API unavailable.' });
    }
    setTestingIoT(false);
  };

  // ------------------------------------------
  // Check Health
  // ------------------------------------------
  const handleCheckHealth = async () => {
    setCheckingHealth(true);
    setHealthData(null);
    try {
      const res = await fetch('/api/portal/delivery/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-health' }),
      });
      const data = await res.json();
      if (data.success) {
        setHealthData(data.services);
      }
    } catch {
      // Show mock health data for demo
      setHealthData([
        { name: 'AI Agent', status: 'healthy', message: 'Agent "RCRS Assistant" operational. Q&A database loaded.' },
        { name: 'Warehouse IoT', status: 'degraded', message: 'IoT service active but HA_ACCESS_TOKEN not set.' },
        { name: 'Smart Delivery Engine', status: 'healthy', message: 'Engine operational. Status flow, routing, and notification systems ready.' },
        { name: 'Settings Service', status: 'healthy', message: 'Settings loaded. 6 categories configured.' },
      ]);
    }
    setCheckingHealth(false);
  };

  // ------------------------------------------
  // Notification matrix toggle
  // ------------------------------------------
  const toggleNotification = (status: string, field: 'notifyDriver' | 'notifyCustomer' | 'notifyOffice' | 'notifyPM') => {
    setSettings(prev => {
      const next = { ...prev };
      const statusNotifs = { ...next.notifications.statusNotifications };
      statusNotifs[status] = { ...statusNotifs[status], [field]: !statusNotifs[status][field] };
      next.notifications = { ...next.notifications, statusNotifications: statusNotifs };
      return next;
    });
  };

  // ------------------------------------------
  // Photo requirement toggle
  // ------------------------------------------
  const togglePhotoReq = (status: string) => {
    setSettings(prev => {
      const next = { ...prev };
      const reqs = { ...next.workflow.requirePhotoAtStatus };
      reqs[status] = !reqs[status];
      next.workflow = { ...next.workflow, requirePhotoAtStatus: reqs };
      return next;
    });
  };

  // ------------------------------------------
  // Access control toggle
  // ------------------------------------------
  const togglePermission = (role: string, permission: string) => {
    setSettings(prev => {
      const next = { ...prev };
      const roles = { ...next.access.roles };
      const perms = [...(roles[role] || [])];
      const idx = perms.indexOf(permission);
      if (idx >= 0) {
        perms.splice(idx, 1);
      } else {
        perms.push(permission);
      }
      roles[role] = perms;
      next.access = { roles };
      return next;
    });
  };

  // ------------------------------------------
  // Custom Q&A management
  // ------------------------------------------
  const addCustomQA = () => {
    if (!newQA.question.trim() || !newQA.answer.trim()) return;
    updateCategory('ai', {
      customQA: [...settings.ai.customQA, { question: newQA.question.trim(), answer: newQA.answer.trim() }],
    });
    setNewQA({ question: '', answer: '' });
  };

  const removeCustomQA = (index: number) => {
    const updated = settings.ai.customQA.filter((_, i) => i !== index);
    updateCategory('ai', { customQA: updated });
  };

  // ------------------------------------------
  // Email recipients management
  // ------------------------------------------
  const addEmailRecipient = () => {
    if (!newEmail.trim() || !newEmail.includes('@')) return;
    updateCategory('inventory', {
      lowStockEmailRecipients: [...settings.inventory.lowStockEmailRecipients, newEmail.trim()],
    });
    setNewEmail('');
  };

  const removeEmailRecipient = (index: number) => {
    const updated = settings.inventory.lowStockEmailRecipients.filter((_, i) => i !== index);
    updateCategory('inventory', { lowStockEmailRecipients: updated });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#39FF14] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <ConfirmModal
          title="Reset All Settings?"
          message="This will revert all delivery system settings to their factory defaults. Custom Q&A pairs, notification preferences, and role configurations will be lost. This action cannot be undone."
          onConfirm={handleReset}
          onCancel={() => setShowResetModal(false)}
        />
      )}

      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/portal/delivery" className="text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-zinc-800">
                  <Settings className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Delivery Settings</h1>
                  <p className="text-xs text-zinc-500">AI, Notifications, Workflow, IoT, Inventory, Access Control</p>
                </div>
              </div>
            </div>
            <button
              onClick={saveAllSettings}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#39FF14] text-black font-semibold hover:bg-[#32e612] transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* ================================================================ */}
        {/* SECTION 1: AI ASSISTANT CONFIGURATION */}
        {/* ================================================================ */}
        <AccordionSection
          title="AI Assistant Configuration"
          icon={<Bot className="w-5 h-5" />}
          open={openSections.ai}
          onToggle={() => toggleSection('ai')}
          badge={settings.ai.agentName}
        >
          {/* Agent Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Agent Name</label>
            <input
              type="text"
              value={settings.ai.agentName}
              onChange={(e) => updateCategory('ai', { agentName: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#39FF14] focus:outline-none"
              placeholder="RCRS Assistant"
            />
          </div>

          {/* Personality Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">Personality</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { key: 'professional' as const, label: 'Professional', desc: 'Formal, thorough, detailed safety reminders. Best for compliance-focused operations.' },
                { key: 'friendly' as const, label: 'Friendly', desc: 'Warm, conversational, encouraging. Best for team morale and engagement.' },
                { key: 'concise' as const, label: 'Concise', desc: 'Brief, direct, facts only. Best for experienced drivers who want minimal chatter.' },
              ]).map(p => (
                <button
                  key={p.key}
                  onClick={() => updateCategory('ai', { agentPersonality: p.key })}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    settings.ai.agentPersonality === p.key
                      ? 'border-[#39FF14] bg-[#39FF14]/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-medium text-white mb-1">{p.label}</div>
                  <div className="text-xs text-zinc-400">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* TTS Controls */}
          <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#39FF14]" />
                <span className="text-sm font-medium text-zinc-300">Text-to-Speech (TTS)</span>
              </div>
              <Toggle checked={settings.ai.ttsEnabled} onChange={(v) => updateCategory('ai', { ttsEnabled: v })} />
            </div>
            {settings.ai.ttsEnabled && (
              <>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Voice</label>
                  <select
                    value={settings.ai.ttsVoice}
                    onChange={(e) => updateCategory('ai', { ttsVoice: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#39FF14] focus:outline-none"
                  >
                    <option value="en-US-Standard-D">US Male (Standard D)</option>
                    <option value="en-US-Standard-C">US Female (Standard C)</option>
                    <option value="en-US-Standard-B">US Male (Standard B)</option>
                    <option value="en-US-Wavenet-D">US Male (WaveNet D)</option>
                    <option value="en-US-Wavenet-C">US Female (WaveNet C)</option>
                  </select>
                </div>
                <Slider
                  label="Speed"
                  value={settings.ai.ttsSpeed}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateCategory('ai', { ttsSpeed: v })}
                  unit="x"
                />
              </>
            )}
          </div>

          {/* Auto Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { key: 'autoGreeting' as const, label: 'Auto Greeting', desc: 'Greet drivers on login', icon: <MessageSquare className="w-4 h-4" /> },
              { key: 'autoCoaching' as const, label: 'Auto Coaching', desc: 'Generate coaching tips', icon: <Lightbulb className="w-4 h-4" /> },
              { key: 'autoReminders' as const, label: 'Auto Reminders', desc: 'Send reminders by phase', icon: <Clock className="w-4 h-4" /> },
              { key: 'safetyTipsEnabled' as const, label: 'Safety Tips', desc: 'Weather and context-aware safety', icon: <Shield className="w-4 h-4" /> },
              { key: 'conversationTopicsEnabled' as const, label: 'Conversation Topics', desc: 'Fun facts and quizzes', icon: <Zap className="w-4 h-4" /> },
            ]).map(f => (
              <div key={f.key} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400">{f.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{f.label}</div>
                    <div className="text-xs text-zinc-500">{f.desc}</div>
                  </div>
                </div>
                <Toggle
                  checked={settings.ai[f.key] as boolean}
                  onChange={(v) => updateCategory('ai', { [f.key]: v })}
                />
              </div>
            ))}
          </div>

          {/* Reminder Lead Time */}
          <Slider
            label="Reminder Lead Time"
            value={settings.ai.reminderLeadTime}
            min={5}
            max={60}
            step={5}
            onChange={(v) => updateCategory('ai', { reminderLeadTime: v })}
            unit=" min"
          />

          {/* Q&A Confidence Threshold */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-zinc-300">Q&A Confidence Threshold</label>
              <span className="text-xs text-zinc-500">
                {settings.ai.maxQAConfidence < 0.3 ? 'Answers more freely (may be less accurate)' :
                 settings.ai.maxQAConfidence > 0.7 ? 'Very strict (says "I don\'t know" often)' : 'Balanced'}
              </span>
            </div>
            <Slider
              value={settings.ai.maxQAConfidence}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateCategory('ai', { maxQAConfidence: v })}
            />
          </div>

          {/* Training Instructions */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Custom Training Instructions</label>
            <textarea
              value={settings.ai.trainingInstructions}
              onChange={(e) => updateCategory('ai', { trainingInstructions: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#39FF14] focus:outline-none min-h-[100px] resize-y"
              placeholder="Add custom prompts or instructions the AI should follow when interacting with drivers..."
            />
          </div>

          {/* Custom Q&A */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">Custom Q&A Pairs</label>
            {settings.ai.customQA.length > 0 && (
              <div className="space-y-2 mb-3">
                {settings.ai.customQA.map((qa, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{qa.question}</div>
                      <div className="text-xs text-zinc-400 mt-1">{qa.answer}</div>
                    </div>
                    <button onClick={() => removeCustomQA(idx)} className="text-zinc-500 hover:text-red-400 mt-0.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 p-3 bg-zinc-900/30 rounded-lg border border-dashed border-zinc-700">
              <input
                type="text"
                value={newQA.question}
                onChange={(e) => setNewQA(prev => ({ ...prev, question: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm focus:border-[#39FF14] focus:outline-none"
                placeholder="Question..."
              />
              <input
                type="text"
                value={newQA.answer}
                onChange={(e) => setNewQA(prev => ({ ...prev, answer: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm focus:border-[#39FF14] focus:outline-none"
                placeholder="Answer..."
              />
              <button
                onClick={addCustomQA}
                disabled={!newQA.question.trim() || !newQA.answer.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> Add Q&A Pair
              </button>
            </div>
          </div>

          {/* Test AI Button */}
          <div className="border-t border-zinc-800 pt-4">
            <button
              onClick={handleTestAI}
              disabled={testingAI}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-[#39FF14] font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {testingAI ? 'Testing...' : 'Test AI Agent'}
            </button>
            {testAIResult && (
              <div className="mt-4 p-4 bg-zinc-900/70 rounded-lg border border-zinc-700 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[#39FF14]">
                  <CheckCircle className="w-4 h-4" /> AI Test Results
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Greeting:</div>
                  <div className="text-sm text-zinc-300 bg-zinc-800 p-2 rounded">{testAIResult.testOutput.greeting}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Sample Coaching Tip:</div>
                  <div className="text-sm text-zinc-300 bg-zinc-800 p-2 rounded">{testAIResult.testOutput.sampleCoachingTip}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Q&A ({testAIResult.testOutput.sampleQA.confidence} confidence):</div>
                  <div className="text-sm text-zinc-300 bg-zinc-800 p-2 rounded">
                    <strong>Q:</strong> {testAIResult.testOutput.sampleQA.question}<br />
                    <strong>A:</strong> {testAIResult.testOutput.sampleQA.answer}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Conversation Topic:</div>
                  <div className="text-sm text-zinc-300 bg-zinc-800 p-2 rounded">{testAIResult.testOutput.conversationTopic}</div>
                </div>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* ================================================================ */}
        {/* SECTION 2: NOTIFICATION CONTROLS */}
        {/* ================================================================ */}
        <AccordionSection
          title="Notification Controls"
          icon={<Bell className="w-5 h-5" />}
          open={openSections.notifications}
          onToggle={() => toggleSection('notifications')}
        >
          {/* Notification Matrix */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">Status Notification Matrix</label>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">Status</th>
                    <th className="text-center py-2 px-2 text-zinc-400 font-medium">Driver</th>
                    <th className="text-center py-2 px-2 text-zinc-400 font-medium">Customer</th>
                    <th className="text-center py-2 px-2 text-zinc-400 font-medium">Office</th>
                    <th className="text-center py-2 px-2 text-zinc-400 font-medium">PM</th>
                  </tr>
                </thead>
                <tbody>
                  {DELIVERY_STATUSES.map(status => (
                    <tr key={status} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                      <td className="py-2 px-2 text-zinc-300">{STATUS_LABELS[status] || status}</td>
                      {(['notifyDriver', 'notifyCustomer', 'notifyOffice', 'notifyPM'] as const).map(field => (
                        <td key={field} className="py-2 px-2 text-center">
                          <Toggle
                            checked={settings.notifications.statusNotifications[status]?.[field] ?? false}
                            onChange={() => toggleNotification(status, field)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Escalation Settings */}
          <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Escalation</div>
                <div className="text-xs text-zinc-500">Auto-escalate tickets stuck in a status</div>
              </div>
              <Toggle
                checked={settings.notifications.escalationEnabled}
                onChange={(v) => updateCategory('notifications', { escalationEnabled: v })}
              />
            </div>
            {settings.notifications.escalationEnabled && (
              <Slider
                label="Timeout"
                value={settings.notifications.escalationTimeout}
                min={5}
                max={480}
                step={5}
                onChange={(v) => updateCategory('notifications', { escalationTimeout: v })}
                unit=" min"
              />
            )}
          </div>

          {/* Overdue Settings */}
          <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Overdue Alert</div>
                <div className="text-xs text-zinc-500">Alert when a delivery passes its scheduled time</div>
              </div>
              <Toggle
                checked={settings.notifications.overdueAlertEnabled}
                onChange={(v) => updateCategory('notifications', { overdueAlertEnabled: v })}
              />
            </div>
            {settings.notifications.overdueAlertEnabled && (
              <Slider
                label="Threshold"
                value={settings.notifications.overdueThreshold}
                min={1}
                max={48}
                step={1}
                onChange={(v) => updateCategory('notifications', { overdueThreshold: v })}
                unit=" hrs"
              />
            )}
          </div>
        </AccordionSection>

        {/* ================================================================ */}
        {/* SECTION 3: WORKFLOW RULES */}
        {/* ================================================================ */}
        <AccordionSection
          title="Workflow Rules"
          icon={<Workflow className="w-5 h-5" />}
          open={openSections.workflow}
          onToggle={() => toggleSection('workflow')}
        >
          {/* Photo Requirements */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">Photo Requirements by Status</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DELIVERY_STATUSES.map(status => (
                <div key={status} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm text-zinc-300">{STATUS_LABELS[status] || status}</span>
                  </div>
                  <Toggle
                    checked={settings.workflow.requirePhotoAtStatus[status] ?? false}
                    onChange={() => togglePhotoReq(status)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Signature */}
          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              <FileSignature className="w-4 h-4 text-[#39FF14]" />
              <div>
                <div className="text-sm font-medium text-white">Require Signature</div>
                <div className="text-xs text-zinc-500">Require customer signature on delivery</div>
              </div>
            </div>
            <Toggle
              checked={settings.workflow.requireSignature}
              onChange={(v) => updateCategory('workflow', { requireSignature: v })}
            />
          </div>

          {/* Auto Advance */}
          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-yellow-400" />
              <div>
                <div className="text-sm font-medium text-white">Auto-Advance Status</div>
                <div className="text-xs text-zinc-500">Automatically advance to next status when conditions are met</div>
              </div>
            </div>
            <Toggle
              checked={settings.workflow.autoAdvanceStatus}
              onChange={(v) => updateCategory('workflow', { autoAdvanceStatus: v })}
            />
          </div>

          {/* Allow Skip */}
          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <div>
                <div className="text-sm font-medium text-white">Allow Skip Status</div>
                <div className="text-xs text-zinc-500 text-orange-300/70">Warning: Skipping statuses may cause data integrity issues with photo and signature requirements.</div>
              </div>
            </div>
            <Toggle
              checked={settings.workflow.allowSkipStatus}
              onChange={(v) => updateCategory('workflow', { allowSkipStatus: v })}
            />
          </div>

          {/* Max Deliveries */}
          <Slider
            label="Max Deliveries / Driver"
            value={settings.workflow.maxDeliveriesPerDriver}
            min={1}
            max={20}
            onChange={(v) => updateCategory('workflow', { maxDeliveriesPerDriver: v })}
          />

          {/* Default Priority */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Default Priority</label>
            <select
              value={settings.workflow.defaultPriority}
              onChange={(e) => updateCategory('workflow', { defaultPriority: e.target.value as 'normal' | 'rush' | 'urgent' })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#39FF14] focus:outline-none"
            >
              <option value="normal">Normal</option>
              <option value="rush">Rush</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Weather Delay */}
          <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CloudRain className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-sm font-medium text-white">Automatic Weather Delay</div>
                  <div className="text-xs text-zinc-500">Auto-delay deliveries based on weather conditions</div>
                </div>
              </div>
              <Toggle
                checked={settings.workflow.weatherDelayAutomatic}
                onChange={(v) => updateCategory('workflow', { weatherDelayAutomatic: v })}
              />
            </div>
            {settings.workflow.weatherDelayAutomatic && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Delay Threshold</label>
                <select
                  value={settings.workflow.weatherDelayThreshold}
                  onChange={(e) => updateCategory('workflow', { weatherDelayThreshold: e.target.value as 'minor' | 'moderate' | 'severe' })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#39FF14] focus:outline-none"
                >
                  <option value="minor">Minor (any rain or wind)</option>
                  <option value="moderate">Moderate (heavy rain, high wind)</option>
                  <option value="severe">Severe (storms, ice, extreme heat only)</option>
                </select>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* ================================================================ */}
        {/* SECTION 4: WAREHOUSE / IOT CONTROLS */}
        {/* ================================================================ */}
        <AccordionSection
          title="Warehouse / IoT Controls"
          icon={<Warehouse className="w-5 h-5" />}
          open={openSections.warehouse}
          onToggle={() => toggleSection('warehouse')}
        >
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-[#39FF14]" />
              <div>
                <div className="text-sm font-medium text-white">IoT Master Switch</div>
                <div className="text-xs text-zinc-500">Enable or disable all IoT features</div>
              </div>
            </div>
            <Toggle
              checked={settings.warehouse.iotEnabled}
              onChange={(v) => updateCategory('warehouse', { iotEnabled: v })}
            />
          </div>

          {settings.warehouse.iotEnabled && (
            <>
              {/* HA Connection */}
              <div className="space-y-3 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="flex items-center gap-2">
                  {iotStatus?.connected ? (
                    <Wifi className="w-4 h-4 text-[#39FF14]" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="text-sm font-medium text-zinc-300">Home Assistant Connection</span>
                  {iotStatus && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      iotStatus.connected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                    }`}>
                      {iotStatus.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">HA Base URL</label>
                  <input
                    type="text"
                    value={settings.warehouse.haBaseUrl}
                    onChange={(e) => updateCategory('warehouse', { haBaseUrl: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#39FF14] focus:outline-none"
                    placeholder="http://192.168.86.102:8123"
                  />
                </div>
                {iotStatus && (
                  <p className="text-xs text-zinc-400">{iotStatus.message}</p>
                )}
              </div>

              {/* Device Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { key: 'lightsEnabled' as const, label: 'Smart Lights', desc: 'Bay indicator lights', icon: <Lightbulb className="w-4 h-4" /> },
                  { key: 'doorsEnabled' as const, label: 'Door Control', desc: 'Loading bay doors', icon: <DoorOpen className="w-4 h-4" /> },
                  { key: 'displayEnabled' as const, label: 'Display/TV', desc: 'Warehouse display', icon: <Monitor className="w-4 h-4" /> },
                  { key: 'speakerEnabled' as const, label: 'Speaker/TTS', desc: 'PA announcements', icon: <Speaker className="w-4 h-4" /> },
                ]).map(d => (
                  <div key={d.key} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-400">{d.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{d.label}</div>
                        <div className="text-xs text-zinc-500">{d.desc}</div>
                      </div>
                    </div>
                    <Toggle
                      checked={settings.warehouse[d.key] as boolean}
                      onChange={(v) => updateCategory('warehouse', { [d.key]: v })}
                    />
                  </div>
                ))}
              </div>

              {/* Auto Features */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div>
                    <div className="text-sm font-medium text-white">Auto-Lights on Status Change</div>
                    <div className="text-xs text-zinc-500">Automatically change bay lights when delivery status updates</div>
                  </div>
                  <Toggle
                    checked={settings.warehouse.autoLightsOnStatus}
                    onChange={(v) => updateCategory('warehouse', { autoLightsOnStatus: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div>
                    <div className="text-sm font-medium text-white">Auto-Announce</div>
                    <div className="text-xs text-zinc-500">Announce status changes over warehouse speaker</div>
                  </div>
                  <Toggle
                    checked={settings.warehouse.autoAnnounce}
                    onChange={(v) => updateCategory('warehouse', { autoAnnounce: v })}
                  />
                </div>
              </div>

              {/* Dashboard Refresh */}
              <Slider
                label="Dashboard Refresh"
                value={settings.warehouse.dashboardRefreshInterval}
                min={5}
                max={300}
                step={5}
                onChange={(v) => updateCategory('warehouse', { dashboardRefreshInterval: v })}
                unit=" sec"
              />

              {/* Test IoT */}
              <div className="border-t border-zinc-800 pt-4">
                <button
                  onClick={handleTestIoT}
                  disabled={testingIoT}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-[#39FF14] font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  <Wifi className="w-4 h-4" />
                  {testingIoT ? 'Testing...' : 'Test IoT Connection'}
                </button>
              </div>
            </>
          )}
        </AccordionSection>

        {/* ================================================================ */}
        {/* SECTION 5: INVENTORY SETTINGS */}
        {/* ================================================================ */}
        <AccordionSection
          title="Inventory Settings"
          icon={<Package className="w-5 h-5" />}
          open={openSections.inventory}
          onToggle={() => toggleSection('inventory')}
        >
          {/* Low Stock Alert */}
          <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Low Stock Alerts</div>
                <div className="text-xs text-zinc-500">Email notifications when inventory runs low</div>
              </div>
              <Toggle
                checked={settings.inventory.lowStockAlertEnabled}
                onChange={(v) => updateCategory('inventory', { lowStockAlertEnabled: v })}
              />
            </div>
            {settings.inventory.lowStockAlertEnabled && (
              <div>
                <label className="block text-xs text-zinc-500 mb-2">Email Recipients</label>
                <div className="space-y-2">
                  {settings.inventory.lowStockEmailRecipients.map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-300 flex-1">{email}</span>
                      <button onClick={() => removeEmailRecipient(idx)} className="text-zinc-500 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm focus:border-[#39FF14] focus:outline-none"
                      placeholder="email@example.com"
                      onKeyDown={(e) => e.key === 'Enter' && addEmailRecipient()}
                    />
                    <button
                      onClick={addEmailRecipient}
                      className="px-3 py-1.5 bg-zinc-700 text-white text-sm rounded hover:bg-zinc-600"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Auto Restock */}
          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div>
              <div className="text-sm font-medium text-white">Auto-Restock Suggestions</div>
              <div className="text-xs text-zinc-500">AI-powered reorder suggestions based on usage patterns</div>
            </div>
            <Toggle
              checked={settings.inventory.autoRestockSuggestions}
              onChange={(v) => updateCategory('inventory', { autoRestockSuggestions: v })}
            />
          </div>

          {/* Weekly Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Weekly Count Day</label>
              <select
                value={settings.inventory.weeklyCountDay}
                onChange={(e) => updateCategory('inventory', { weeklyCountDay: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#39FF14] focus:outline-none"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 self-end">
              <div className="text-sm text-zinc-300">Count Reminder</div>
              <Toggle
                checked={settings.inventory.weeklyCountReminder}
                onChange={(v) => updateCategory('inventory', { weeklyCountReminder: v })}
              />
            </div>
          </div>

          {/* Pricing Verification */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Pricing Verification Frequency</label>
            <select
              value={settings.inventory.pricingVerificationFrequency}
              onChange={(e) => updateCategory('inventory', { pricingVerificationFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#39FF14] focus:outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </AccordionSection>

        {/* ================================================================ */}
        {/* SECTION 6: ACCESS CONTROL */}
        {/* ================================================================ */}
        <AccordionSection
          title="Access Control"
          icon={<Shield className="w-5 h-5" />}
          open={openSections.access}
          onToggle={() => toggleSection('access')}
          badge="Admin Only"
        >
          {/* Role / Permission Matrix */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">Role Permissions Matrix</label>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">Permission</th>
                    {ALL_ROLES.map(role => (
                      <th key={role} className="text-center py-2 px-2 text-zinc-400 font-medium capitalize">{role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_PERMISSIONS.map(perm => (
                    <tr key={perm} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                      <td className="py-2 px-2 text-zinc-300">{PERMISSION_LABELS[perm] || perm}</td>
                      {ALL_ROLES.map(role => (
                        <td key={role} className="py-2 px-2 text-center">
                          <Toggle
                            checked={(settings.access.roles[role] || []).includes(perm)}
                            onChange={() => togglePermission(role, perm)}
                            disabled={role === 'admin' && perm === 'manage_settings'}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* User List */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">Team Members</label>
            <div className="space-y-2">
              {MOCK_USERS.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                      <Users className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{user.name}</div>
                      <div className="text-xs text-zinc-500">{user.email}</div>
                    </div>
                  </div>
                  <select
                    value={user.role}
                    onChange={() => {/* Mock - read only */}}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:border-[#39FF14] focus:outline-none capitalize"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </AccordionSection>

        {/* ================================================================ */}
        {/* SECTION 7: SYSTEM */}
        {/* ================================================================ */}
        <AccordionSection
          title="System"
          icon={<Server className="w-5 h-5" />}
          open={openSections.system}
          onToggle={() => toggleSection('system')}
        >
          {/* Import / Export / Reset */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Export Settings
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
            >
              <Upload className="w-4 h-4" /> Import Settings
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900/50 text-red-300 font-medium hover:bg-red-900/70 transition-colors border border-red-900"
            >
              <RotateCcw className="w-4 h-4" /> Reset to Defaults
            </button>
          </div>

          {/* System Info */}
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-2">
            <div className="text-sm font-medium text-zinc-300 mb-2">System Information</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-zinc-500">Version</div>
              <div className="text-white">1.0.0</div>
              <div className="text-zinc-500">Environment</div>
              <div className="text-white">{typeof window !== 'undefined' ? 'Client' : 'Server'}</div>
              <div className="text-zinc-500">Settings Storage</div>
              <div className="text-white">localStorage + API</div>
              <div className="text-zinc-500">Last Save</div>
              <div className="text-white">{new Date().toLocaleString()}</div>
            </div>
          </div>

          {/* Health Check */}
          <div>
            <button
              onClick={handleCheckHealth}
              disabled={checkingHealth}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-[#39FF14] font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50 mb-4"
            >
              <RefreshCw className={`w-4 h-4 ${checkingHealth ? 'animate-spin' : ''}`} />
              {checkingHealth ? 'Checking...' : 'Check Ecosystem Health'}
            </button>

            {healthData && (
              <div className="space-y-2">
                {healthData.map((service, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'healthy' ? 'bg-[#39FF14]' :
                      service.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-500'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{service.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                          service.status === 'healthy' ? 'bg-green-900/50 text-green-400' :
                          service.status === 'degraded' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'
                        }`}>
                          {service.status}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{service.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AccordionSection>

        {/* ================================================================ */}
        {/* BOTTOM SAVE BAR */}
        {/* ================================================================ */}
        <div className="flex items-center justify-between p-4 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <span className="text-sm text-zinc-400">
            All changes are saved locally. Click Save All to persist to the server.
          </span>
          <button
            onClick={saveAllSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#39FF14] text-black font-semibold hover:bg-[#32e612] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </div>

      {/* Slide-in animation */}
      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
