import { NextRequest, NextResponse } from 'next/server';
import {
  scheduledTasks,
  getTaskById,
  getTasksByDate,
  getTasksByAssignee,
  getTasksByStatus,
  getTasksByType,
  getUpcomingTasks,
  getOverdueTasks,
  getTodaysTasks,
  getTaskStats,
  generateTaskId,
  ScheduledTask,
  TaskStatus,
  TaskType
} from '@/lib/scheduledTasks';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const date = searchParams.get('date');
    const assignee = searchParams.get('assignee');
    const status = searchParams.get('status') as TaskStatus | null;
    const type = searchParams.get('type') as TaskType | null;
    const upcoming = searchParams.get('upcoming');
    const overdue = searchParams.get('overdue');
    const today = searchParams.get('today');
    const stats = searchParams.get('stats');

    // Get task statistics
    if (stats === 'true') {
      return NextResponse.json(getTaskStats());
    }

    // Get single task
    if (taskId) {
      const task = getTaskById(taskId);
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json(task);
    }

    // Get tasks by date
    if (date) {
      const tasks = getTasksByDate(date);
      return NextResponse.json(tasks);
    }

    // Get tasks by assignee
    if (assignee) {
      const tasks = getTasksByAssignee(assignee);
      return NextResponse.json(tasks);
    }

    // Get tasks by status
    if (status) {
      const tasks = getTasksByStatus(status);
      return NextResponse.json(tasks);
    }

    // Get tasks by type
    if (type) {
      const tasks = getTasksByType(type);
      return NextResponse.json(tasks);
    }

    // Get upcoming tasks
    if (upcoming) {
      const days = parseInt(upcoming) || 7;
      const tasks = getUpcomingTasks(days);
      return NextResponse.json(tasks);
    }

    // Get overdue tasks
    if (overdue === 'true') {
      const tasks = getOverdueTasks();
      return NextResponse.json(tasks);
    }

    // Get today's tasks
    if (today === 'true') {
      const tasks = getTodaysTasks();
      return NextResponse.json(tasks);
    }

    // Return all tasks with stats
    return NextResponse.json({
      tasks: scheduledTasks.sort((a, b) => {
        const dateA = new Date(`${a.dueDate}T${a.dueTime || '00:00'}`);
        const dateB = new Date(`${b.dueDate}T${b.dueTime || '00:00'}`);
        return dateA.getTime() - dateB.getTime();
      }),
      stats: getTaskStats()
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, ...params } = data;

    switch (action) {
      case 'create':
        // Create new task
        const newTask: ScheduledTask = {
          taskId: generateTaskId(),
          title: params.title,
          description: params.description,
          type: params.type || 'other',
          priority: params.priority || 'medium',
          status: 'pending',
          assignedTo: params.assignedTo,
          assignedToName: params.assignedToName,
          dueDate: params.dueDate,
          dueTime: params.dueTime,
          estimatedDuration: params.estimatedDuration,
          location: params.location,
          jobNumber: params.jobNumber,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          notes: params.notes,
          createdBy: params.createdBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurring: params.recurring
        };

        return NextResponse.json({ success: true, task: newTask });

      case 'updateStatus':
        // Update task status
        return NextResponse.json({
          success: true,
          message: `Task ${params.taskId} status updated to ${params.status}`
        });

      case 'complete':
        // Complete task
        return NextResponse.json({
          success: true,
          message: `Task ${params.taskId} marked as completed`,
          completedAt: new Date().toISOString(),
          completedBy: params.completedBy
        });

      case 'cancel':
        // Cancel task
        return NextResponse.json({
          success: true,
          message: `Task ${params.taskId} cancelled`
        });

      case 'reassign':
        // Reassign task
        return NextResponse.json({
          success: true,
          message: `Task ${params.taskId} reassigned to ${params.assignedToName}`
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing task request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
