'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TodoTask } from '../lib/types';
import { todoService } from '../services/todoService';
import { useAuth } from '../hooks/useAuth';

interface TodoTaskWidgetProps {
  userId?: string; // Optional - will use auth if not provided
  noContainer?: boolean; // If true, removes outer container styling (for use inside another container)
}

interface DashboardCalendarItem {
  id: string;
  title: string;
  kind: 'task' | 'note';
  scheduledAt: string; // ISO datetime
}

const TodoTaskWidget: React.FC<TodoTaskWidgetProps> = ({ userId, noContainer = false }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryKind, setEntryKind] = useState<'task' | 'note'>('task');
  const [entryDateTime, setEntryDateTime] = useState(() => {
    const now = new Date();
    now.setHours(9, 0, 0, 0); // Default to 9 AM today
    return now.toISOString().slice(0, 16); // Format for datetime-local input
  });

  const currentUserId = userId || user?.uid || 'iro-admin'; // Fallback to 'iro-admin' if no user

  // Subscribe to todos
  useEffect(() => {
    setLoading(true);
    const unsubscribe = todoService.subscribe(currentUserId, (fetchedTasks) => {
      setTasks(fetchedTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || isAdding) return;

    setIsAdding(true);
    try {
      await todoService.create({
        title: newTaskTitle.trim(),
        completed: false,
        createdBy: currentUserId,
      });
      setNewTaskTitle('');
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddWithDateTime = async () => {
    if (!entryTitle.trim() || isAdding) return;

    setIsAdding(true);
    try {
      // Create todo task if it's a task
      if (entryKind === 'task') {
        await todoService.create({
          title: entryTitle.trim(),
          completed: false,
          createdBy: currentUserId,
        });
      }

      // Add to calendar items in localStorage
      const calendarItem: DashboardCalendarItem = {
        id: `${entryKind}-${Date.now()}`,
        title: entryTitle.trim(),
        kind: entryKind,
        scheduledAt: new Date(entryDateTime).toISOString(),
      };

      // Load existing items, add new one, save back
      try {
        const existing = localStorage.getItem('dashboard-calendar-items');
        const items: DashboardCalendarItem[] = existing ? JSON.parse(existing) : [];
        items.push(calendarItem);
        localStorage.setItem('dashboard-calendar-items', JSON.stringify(items));
        
        // Trigger a custom event so CalendarWidget can refresh
        window.dispatchEvent(new CustomEvent('dashboard-calendar-updated'));
      } catch (e) {
        console.error('Error saving calendar item:', e);
      }

      // Reset form
      setEntryTitle('');
      setEntryKind('task');
      const now = new Date();
      now.setHours(9, 0, 0, 0);
      setEntryDateTime(now.toISOString().slice(0, 16));
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding task/note:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleComplete = async (taskId: string, currentCompleted: boolean) => {
    try {
      await todoService.update(taskId, { completed: !currentCompleted });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await todoService.delete(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Sort tasks: incomplete first, then completed (newest first within each group)
  const sortedTasks = useMemo(() => {
    const incomplete = tasks.filter(t => !t.completed).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const completed = tasks.filter(t => t.completed).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return [...incomplete, ...completed];
  }, [tasks]);

  const containerClasses = noContainer 
    ? "h-full flex flex-col"
    : "h-full flex flex-col bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-md p-5 relative overflow-hidden";

  return (
    <div className={containerClasses}>
      {/* Noise texture - only show if not in container */}
      {!noContainer && (
        <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-[0.02] dark:opacity-[0.05]">
            <filter id="todo-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#todo-noise)" />
          </svg>
        </div>
      )}

      <div className={`${noContainer ? '' : 'relative z-10'} h-full flex flex-col`}>
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">To-do Task</h3>
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">Checklist</p>
        </div>

        {/* Add Task Input */}
        <div className="mb-4 flex gap-2 min-w-0">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddTask();
              }
            }}
            placeholder="Add a task..."
            className="flex-1 min-w-0 px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/50 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary/50 dark:focus:ring-primary-light/50 focus:border-transparent transition-all"
            disabled={isAdding}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={isAdding}
            className="px-2.5 py-2 text-xs font-bold bg-primary dark:bg-primary-light text-white dark:text-neutral-900 rounded-lg hover:bg-primary/90 dark:hover:bg-primary-light/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            title="Add task or note to calendar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sortedTasks.length > 0 ? (
            <div className="space-y-2">
              {sortedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => handleToggleComplete(task.id, task.completed)}
                    className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary cursor-pointer"
                  />
                  <span
                    className={`flex-1 text-xs font-medium ${
                      task.completed
                        ? 'text-neutral-400 dark:text-neutral-500 line-through'
                        : 'text-neutral-900 dark:text-white'
                    }`}
                  >
                    {task.title}
                  </span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
                    aria-label="Delete task"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">No tasks yet</p>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Add one above!</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Task/Note Modal with Date/Time Picker */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-5 w-full max-w-md mx-4 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Add to Calendar</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setEntryKind('task')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${entryKind === 'task'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-neutral-50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600'
                  }`}
              >
                Task
              </button>
              <button
                onClick={() => setEntryKind('note')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${entryKind === 'note'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-neutral-50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600'
                  }`}
              >
                Note
              </button>
            </div>

            <input
              type="text"
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder={`${entryKind === 'task' ? 'Task' : 'Note'} title...`}
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700/60 border border-neutral-200 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white mb-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && entryTitle.trim()) {
                  handleAddWithDateTime();
                }
              }}
            />

            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={entryDateTime}
              onChange={(e) => setEntryDateTime(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700/60 border border-neutral-200 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWithDateTime}
                disabled={!entryTitle.trim() || isAdding}
                className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodoTaskWidget;

