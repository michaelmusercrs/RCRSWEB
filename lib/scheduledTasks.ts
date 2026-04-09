// Scheduled Tasks Data
// Last Updated: December 2025

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
export type TaskType = 'delivery' | 'inspection' | 'installation' | 'repair' | 'meeting' | 'follow_up' | 'inventory' | 'other';

export interface ScheduledTask {
  taskId: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string;
  assignedToName: string;
  dueDate: string;
  dueTime?: string;
  estimatedDuration?: number; // in minutes
  location?: string;
  jobNumber?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: string;
  };
}

// Scheduled tasks should be loaded from a real source (Google Sheets `Tasks`
// tab) at runtime. This array is intentionally empty — the previous hardcoded
// sample data ("Robert Johnson", "Smith Properties LLC", "Sarah Williams",
// "James Brown", "Mike Anderson") broke the no-fake-data rule and was
// surfacing on the RoofStack HQ dashboard.
export const scheduledTasks: ScheduledTask[] = [];

// Helper functions
export function getTaskById(taskId: string): ScheduledTask | undefined {
  return scheduledTasks.find(t => t.taskId === taskId);
}

export function getTasksByDate(date: string): ScheduledTask[] {
  return scheduledTasks.filter(t => t.dueDate === date);
}

export function getTasksByAssignee(email: string): ScheduledTask[] {
  return scheduledTasks.filter(t => t.assignedTo.toLowerCase() === email.toLowerCase());
}

export function getTasksByStatus(status: TaskStatus): ScheduledTask[] {
  return scheduledTasks.filter(t => t.status === status);
}

export function getTasksByType(type: TaskType): ScheduledTask[] {
  return scheduledTasks.filter(t => t.type === type);
}

export function getUpcomingTasks(days: number = 7): ScheduledTask[] {
  const today = new Date();
  const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  return scheduledTasks.filter(t => {
    const taskDate = new Date(t.dueDate);
    return taskDate >= today && taskDate <= endDate && t.status !== 'completed' && t.status !== 'cancelled';
  }).sort((a, b) => {
    const dateA = new Date(`${a.dueDate}T${a.dueTime || '00:00'}`);
    const dateB = new Date(`${b.dueDate}T${b.dueTime || '00:00'}`);
    return dateA.getTime() - dateB.getTime();
  });
}

export function getOverdueTasks(): ScheduledTask[] {
  const today = new Date().toISOString().slice(0, 10);
  return scheduledTasks.filter(t =>
    t.dueDate < today && t.status !== 'completed' && t.status !== 'cancelled'
  );
}

export function getTodaysTasks(): ScheduledTask[] {
  const today = new Date().toISOString().slice(0, 10);
  return getTasksByDate(today);
}

export function generateTaskId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TASK-${date}-${random}`;
}

// Get task statistics
export function getTaskStats() {
  const today = new Date().toISOString().slice(0, 10);
  const pending = scheduledTasks.filter(t => t.status === 'pending').length;
  const inProgress = scheduledTasks.filter(t => t.status === 'in_progress').length;
  const completed = scheduledTasks.filter(t => t.status === 'completed').length;
  const overdue = scheduledTasks.filter(t => t.dueDate < today && t.status !== 'completed' && t.status !== 'cancelled').length;
  const todayCount = getTasksByDate(today).length;

  return {
    total: scheduledTasks.length,
    pending,
    inProgress,
    completed,
    overdue,
    todayCount
  };
}
