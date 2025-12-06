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

// Sample scheduled tasks
export const scheduledTasks: ScheduledTask[] = [
  {
    taskId: 'TASK-20251204-001',
    title: 'Roof Inspection - Johnson Property',
    description: 'Complete storm damage assessment for insurance claim',
    type: 'inspection',
    priority: 'high',
    status: 'pending',
    assignedTo: 'hunter@rcrsal.com',
    assignedToName: 'Hunter',
    dueDate: '2025-12-04',
    dueTime: '09:00',
    estimatedDuration: 90,
    location: '123 Oak Street, Huntsville, AL 35801',
    jobNumber: 'JOB-2024-1234',
    customerName: 'Robert Johnson',
    customerPhone: '256-555-0101',
    createdBy: 'sara@rcrsal.com',
    createdAt: '2025-12-03T10:00:00Z',
    updatedAt: '2025-12-03T10:00:00Z'
  },
  {
    taskId: 'TASK-20251204-002',
    title: 'Material Delivery - Smith Commercial',
    description: 'Deliver materials for commercial building project',
    type: 'delivery',
    priority: 'urgent',
    status: 'in_progress',
    assignedTo: 'richard@rivercityroofingsolutions.com',
    assignedToName: 'Richard',
    dueDate: '2025-12-04',
    dueTime: '10:30',
    estimatedDuration: 60,
    location: '456 Industrial Blvd, Decatur, AL 35601',
    jobNumber: 'JOB-2024-1235',
    customerName: 'Smith Properties LLC',
    customerPhone: '256-555-0102',
    createdBy: 'tia@rcrsal.com',
    createdAt: '2025-12-03T14:00:00Z',
    updatedAt: '2025-12-04T08:30:00Z'
  },
  {
    taskId: 'TASK-20251204-003',
    title: 'Roof Installation - Williams Residence',
    description: 'Complete shingle installation, crew 2',
    type: 'installation',
    priority: 'high',
    status: 'pending',
    assignedTo: 'john@rcrsal.com',
    assignedToName: 'John',
    dueDate: '2025-12-04',
    dueTime: '07:00',
    estimatedDuration: 480,
    location: '789 Maple Lane, Madison, AL 35758',
    jobNumber: 'JOB-2024-1236',
    customerName: 'Sarah Williams',
    customerPhone: '256-555-0103',
    notes: 'Full tear-off and replacement. 30 squares. IKO Dynasty shingles.',
    createdBy: 'bart@rcrsal.com',
    createdAt: '2025-12-02T09:00:00Z',
    updatedAt: '2025-12-02T09:00:00Z'
  },
  {
    taskId: 'TASK-20251204-004',
    title: 'Weekly Inventory Count',
    description: 'Count all warehouse inventory items',
    type: 'inventory',
    priority: 'medium',
    status: 'pending',
    assignedTo: 'tae@rcrsal.com',
    assignedToName: 'Tae',
    dueDate: '2025-12-04',
    dueTime: '15:00',
    estimatedDuration: 120,
    location: 'RCRS Warehouse A',
    createdBy: 'sara@rcrsal.com',
    createdAt: '2025-12-01T08:00:00Z',
    updatedAt: '2025-12-01T08:00:00Z',
    recurring: {
      frequency: 'weekly',
      interval: 1
    }
  },
  {
    taskId: 'TASK-20251204-005',
    title: 'Customer Follow-up Call - Brown',
    description: 'Follow up on inspection proposal sent last week',
    type: 'follow_up',
    priority: 'low',
    status: 'pending',
    assignedTo: 'brendon@rcrsal.com',
    assignedToName: 'Brendon',
    dueDate: '2025-12-04',
    dueTime: '14:00',
    estimatedDuration: 15,
    customerName: 'James Brown',
    customerPhone: '256-555-0104',
    createdBy: 'brendon@rcrsal.com',
    createdAt: '2025-12-03T16:00:00Z',
    updatedAt: '2025-12-03T16:00:00Z'
  },
  {
    taskId: 'TASK-20251205-001',
    title: 'Team Meeting - Weekly Standup',
    description: 'Weekly team meeting to review projects and priorities',
    type: 'meeting',
    priority: 'medium',
    status: 'pending',
    assignedTo: 'chrismuse@rcrsal.com',
    assignedToName: 'Chris Muse',
    dueDate: '2025-12-05',
    dueTime: '08:00',
    estimatedDuration: 60,
    location: 'RCRS Office - Conference Room',
    createdBy: 'chrismuse@rcrsal.com',
    createdAt: '2025-12-01T08:00:00Z',
    updatedAt: '2025-12-01T08:00:00Z',
    recurring: {
      frequency: 'weekly',
      interval: 1
    }
  },
  {
    taskId: 'TASK-20251205-002',
    title: 'Roof Repair - Anderson Property',
    description: 'Emergency leak repair, flashing around chimney',
    type: 'repair',
    priority: 'urgent',
    status: 'pending',
    assignedTo: 'john@rcrsal.com',
    assignedToName: 'John',
    dueDate: '2025-12-05',
    dueTime: '07:30',
    estimatedDuration: 180,
    location: '321 Pine Drive, Athens, AL 35611',
    jobNumber: 'JOB-2024-1237',
    customerName: 'Mike Anderson',
    customerPhone: '256-555-0105',
    notes: 'Customer reports active leak during rain. Priority repair.',
    createdBy: 'sara@rcrsal.com',
    createdAt: '2025-12-04T07:00:00Z',
    updatedAt: '2025-12-04T07:00:00Z'
  }
];

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
