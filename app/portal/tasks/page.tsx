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
  MoreHorizontal
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

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700'
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  overdue: 'bg-red-100 text-red-700'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/portal/dashboard" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Scheduled Tasks</h1>
                <p className="text-sm text-gray-500">Manage and track all tasks</p>
              </div>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>New Task</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total Tasks</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.todayCount}</div>
              <div className="text-sm text-gray-500">Today</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-sm text-gray-500">In Progress</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
              <div className="text-sm text-gray-500">Overdue</div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tasks, assignees, customers, jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-5 h-5" />
              <span>Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No tasks found</h3>
              <p className="text-gray-500">Try adjusting your filters or search term</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.taskId}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedTask(selectedTask?.taskId === task.taskId ? null : task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg ${
                      task.type === 'delivery' ? 'bg-purple-100 text-purple-600' :
                      task.type === 'inspection' ? 'bg-blue-100 text-blue-600' :
                      task.type === 'installation' ? 'bg-green-100 text-green-600' :
                      task.type === 'repair' ? 'bg-orange-100 text-orange-600' :
                      task.type === 'meeting' ? 'bg-pink-100 text-pink-600' :
                      task.type === 'follow_up' ? 'bg-cyan-100 text-cyan-600' :
                      task.type === 'inventory' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {typeIcons[task.type]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-gray-900">{task.title}</h3>
                        {task.recurring && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            Recurring
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
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
                          <span className="text-gray-400">
                            ({formatDuration(task.estimatedDuration)})
                          </span>
                        )}
                        <span className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {task.assignedToName}
                        </span>
                      </div>
                      {task.jobNumber && (
                        <div className="text-sm text-blue-600 mt-1">
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
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {task.description && (
                        <div className="md:col-span-2">
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                          <p className="text-sm text-gray-600">{task.description}</p>
                        </div>
                      )}
                      {task.location && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Location</h4>
                          <p className="text-sm text-gray-600 flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {task.location}
                          </p>
                        </div>
                      )}
                      {task.customerName && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Customer</h4>
                          <p className="text-sm text-gray-600">{task.customerName}</p>
                          {task.customerPhone && (
                            <p className="text-sm text-blue-600 flex items-center mt-1">
                              <Phone className="w-4 h-4 mr-1" />
                              {task.customerPhone}
                            </p>
                          )}
                        </div>
                      )}
                      {task.notes && (
                        <div className="md:col-span-2">
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                          <p className="text-sm text-gray-600">{task.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2 mt-4">
                      {task.status === 'pending' && (
                        <button className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
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
                      <button className="flex items-center space-x-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
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
