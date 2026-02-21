'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Filter,
  Search,
  Plus,
  ChevronDown,
  Truck,
  ClipboardCheck,
  Wrench,
  Users,
  PhoneCall,
  Package,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';

interface ScheduledTask {
  taskId: string;
  title: string;
  description?: string;
  type: 'delivery' | 'inspection' | 'installation' | 'repair' | 'meeting' | 'follow_up' | 'inventory' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  assignedTo: string;
  assignedToName: string;
  dueDate: string;
  dueTime?: string;
  estimatedDuration?: number;
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

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  todayCount: number;
}

const typeIcons: Record<string, React.ReactNode> = {
  delivery: <Truck className="w-4 h-4" />,
  inspection: <ClipboardCheck className="w-4 h-4" />,
  installation: <Wrench className="w-4 h-4" />,
  repair: <Wrench className="w-4 h-4" />,
  meeting: <Users className="w-4 h-4" />,
  follow_up: <PhoneCall className="w-4 h-4" />,
  inventory: <Package className="w-4 h-4" />,
  other: <MoreHorizontal className="w-4 h-4" />
};

const typeColors: Record<string, string> = {
  delivery: 'bg-purple-500/20 text-purple-400',
  inspection: 'bg-blue-500/20 text-blue-400',
  installation: 'bg-green-500/20 text-green-400',
  repair: 'bg-orange-500/20 text-orange-400',
  meeting: 'bg-pink-500/20 text-pink-400',
  follow_up: 'bg-cyan-500/20 text-cyan-400',
  inventory: 'bg-amber-500/20 text-amber-400',
  other: 'bg-zinc-500/20 text-zinc-400',
};

const priorityColors: Record<string, string> = {
  low: 'bg-zinc-500/20 text-zinc-300',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400'
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-zinc-500/20 text-zinc-500',
  overdue: 'bg-red-500/20 text-red-400'
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/portal/tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignedToName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesType = typeFilter === 'all' || task.type === typeFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-[#39FF14] mx-auto mb-4" />
          <p className="text-zinc-400">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/portal/dashboard" className="text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">Scheduled Tasks</h1>
                <p className="text-sm text-zinc-400">Manage and track all tasks</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchTasks}
                className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-zinc-400" />
              </button>
              <button className="bg-[#39FF14] text-black px-4 py-2 rounded-lg hover:bg-[#39FF14]/90 font-medium flex items-center space-x-2">
                <Plus className="w-5 h-5" />
                <span>New Task</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Total Tasks', value: stats.total, color: 'text-white' },
              { label: 'Today', value: stats.todayCount, color: 'text-[#39FF14]' },
              { label: 'Pending', value: stats.pending, color: 'text-yellow-400' },
              { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400' },
              { label: 'Completed', value: stats.completed, color: 'text-green-400' },
              { label: 'Overdue', value: stats.overdue, color: 'text-red-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tasks, assignees, customers, jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50 bg-zinc-800 text-white placeholder-zinc-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 border border-zinc-700 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors"
            >
              <Filter className="w-5 h-5" />
              <span>Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-zinc-800">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-800 text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-800 text-white"
                >
                  <option value="all">All Types</option>
                  <option value="delivery">Delivery</option>
                  <option value="inspection">Inspection</option>
                  <option value="installation">Installation</option>
                  <option value="repair">Repair</option>
                  <option value="meeting">Meeting</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="inventory">Inventory</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-800 text-white"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
              <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white">No tasks found</h3>
              <p className="text-zinc-500">Try adjusting your filters or search term</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.taskId}
                className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition-colors cursor-pointer"
                onClick={() => setSelectedTask(selectedTask?.taskId === task.taskId ? null : task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg ${typeColors[task.type] || typeColors.other}`}>
                      {typeIcons[task.type]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-white">{task.title}</h3>
                        {task.recurring && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                            Recurring
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(task.dueDate)}
                        </span>
                        {task.dueTime && (
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {formatTime(task.dueTime)}
                          </span>
                        )}
                        {task.estimatedDuration && (
                          <span className="text-zinc-600">
                            ({formatDuration(task.estimatedDuration)})
                          </span>
                        )}
                        <span className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {task.assignedToName}
                        </span>
                      </div>
                      {task.jobNumber && (
                        <div className="text-sm text-[#39FF14] mt-1">
                          Job: {task.jobNumber}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[task.status]}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedTask?.taskId === task.taskId && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {task.description && (
                        <div className="md:col-span-2">
                          <h4 className="text-sm font-medium text-zinc-400 mb-1">Description</h4>
                          <p className="text-sm text-zinc-300">{task.description}</p>
                        </div>
                      )}
                      {task.location && (
                        <div>
                          <h4 className="text-sm font-medium text-zinc-400 mb-1">Location</h4>
                          <p className="text-sm text-zinc-300 flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {task.location}
                          </p>
                        </div>
                      )}
                      {task.customerName && (
                        <div>
                          <h4 className="text-sm font-medium text-zinc-400 mb-1">Customer</h4>
                          <p className="text-sm text-zinc-300">{task.customerName}</p>
                          {task.customerPhone && (
                            <a href={`tel:${task.customerPhone}`} className="text-sm text-[#39FF14] flex items-center mt-1 hover:underline">
                              <Phone className="w-4 h-4 mr-1" />
                              {task.customerPhone}
                            </a>
                          )}
                        </div>
                      )}
                      {task.notes && (
                        <div className="md:col-span-2">
                          <h4 className="text-sm font-medium text-zinc-400 mb-1">Notes</h4>
                          <p className="text-sm text-zinc-300">{task.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2 mt-4">
                      {task.status === 'pending' && (
                        <button className="flex items-center space-x-1 px-3 py-1.5 bg-[#39FF14] text-black rounded-lg hover:bg-[#39FF14]/90 text-sm font-medium">
                          <Play className="w-4 h-4" />
                          <span>Start</span>
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <>
                          <button className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span>Complete</span>
                          </button>
                          <button className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm">
                            <Pause className="w-4 h-4" />
                            <span>Pause</span>
                          </button>
                        </>
                      )}
                      <button className="flex items-center space-x-1 px-3 py-1.5 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
