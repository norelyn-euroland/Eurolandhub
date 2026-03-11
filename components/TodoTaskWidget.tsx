'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TodoTask } from '../lib/types';
import { todoService } from '../services/todoService';
import { useAuth } from '../hooks/useAuth';

interface TodoTaskWidgetProps {
  userId?: string; // Optional - will use auth if not provided
  noContainer?: boolean; // If true, removes outer container styling (for use inside another container)
}

const TodoTaskWidget: React.FC<TodoTaskWidgetProps> = ({ userId, noContainer = false }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeDate, setActiveDate] = useState<string>(() => {
    // Default to today's date
    return new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });
  const [entryTitle, setEntryTitle] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [menuOpenTaskId, setMenuOpenTaskId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const currentUserId = userId || user?.uid || 'iro-admin'; // Fallback to 'iro-admin' if no user

  // Listen for calendar date selection (NOT opening modal automatically)
  useEffect(() => {
    const handleCalendarDateSelected = (event: any) => {
      if (event.detail && event.detail.date) {
        setActiveDate(event.detail.date);
        // Do NOT open modal - just set the active date
      }
    };

    window.addEventListener('calendar-day-selected', handleCalendarDateSelected);
    return () => window.removeEventListener('calendar-day-selected', handleCalendarDateSelected);
  }, []);

  // Subscribe to todos
  useEffect(() => {
    setLoading(true);
    const unsubscribe = todoService.subscribe(currentUserId, (fetchedTasks) => {
      setTasks(fetchedTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isAddModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isAddModalOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setMenuOpenTaskId(null);
    };
    if (menuOpenTaskId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [menuOpenTaskId]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleOpenAddModal = () => {
    setEditingTask(null);
    setEntryTitle('');
    setEntryDescription('');
    setScheduledDate(activeDate); // Use the active date from calendar
    setIsAddModalOpen(true);
  };

  const handleSaveTask = async () => {
    if (!entryTitle.trim() || isAdding) return;

    setIsAdding(true);
    try {
      const dateOnly = scheduledDate ? scheduledDate.split('T')[0] : undefined;
      
      if (editingTask) {
        // Update existing task
        await todoService.update(editingTask.id, {
          title: entryTitle.trim(),
          description: entryDescription.trim() || undefined,
          scheduledDate: dateOnly,
        });
      } else {
        // Create new task
        await todoService.create({
          title: entryTitle.trim(),
          description: entryDescription.trim() || undefined,
          completed: false,
          createdBy: currentUserId,
          scheduledDate: dateOnly,
        });
      }

      // Reset form
      setEntryTitle('');
      setEntryDescription('');
      setScheduledDate(activeDate);
      setEditingTask(null);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditTask = (task: TodoTask) => {
    setEditingTask(task);
    setEntryTitle(task.title);
    setEntryDescription(task.description || '');
    setScheduledDate(task.scheduledDate ? task.scheduledDate.split('T')[0] : activeDate);
    setIsAddModalOpen(true);
    setMenuOpenTaskId(null);
  };

  const handleToggleComplete = async (taskId: string, currentCompleted: boolean) => {
    try {
      await todoService.update(taskId, { completed: !currentCompleted });
      setMenuOpenTaskId(null);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await todoService.delete(taskId);
      setMenuOpenTaskId(null);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Filter tasks for the active date
  const activeDateTasks = useMemo(() => {
    const filtered = tasks.filter(task => {
      if (!task.scheduledDate) {
        // Tasks without scheduled date are shown for today
        const today = new Date().toISOString().split('T')[0];
        return activeDate === today;
      }
      return task.scheduledDate.split('T')[0] === activeDate;
    });

    // Sort: incomplete first, then completed (newest first within each group)
    const incomplete = filtered.filter(t => !t.completed).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const completed = filtered.filter(t => t.completed).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return [...incomplete, ...completed];
  }, [tasks, activeDate]);

  // Format time for display
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

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
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
            {activeDate === new Date().toISOString().split('T')[0] 
              ? 'Today\'s tasks' 
              : `Tasks for ${formatDate(activeDate)}`}
          </p>
        </div>

        {/* Add Task Button */}
        <div className="mb-4">
          <button
            onClick={handleOpenAddModal}
            disabled={isAdding}
            className="w-full px-3 py-2 text-xs font-bold bg-primary dark:bg-primary-light text-white dark:text-neutral-900 rounded-lg hover:bg-primary/90 dark:hover:bg-primary-light/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            title="Add a new task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Task</span>
          </button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeDateTasks.length > 0 ? (
            <div className="space-y-2">
              {activeDateTasks.map((task) => {
                const isExpanded = expandedTasks.has(task.id);
                const hasDescription = task.description && task.description.trim().length > 0;
                const isMenuOpen = menuOpenTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="p-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleComplete(task.id, task.completed)}
                        className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary cursor-pointer mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-xs font-medium ${
                                task.completed
                                  ? 'text-neutral-400 dark:text-neutral-500 line-through'
                                  : 'text-neutral-900 dark:text-white'
                              } ${hasDescription ? 'cursor-pointer' : ''}`}
                              onClick={() => hasDescription && toggleTaskExpansion(task.id)}
                            >
                              {task.title}
                            </div>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              Added at {formatTime(task.createdAt)}
                            </div>
                          </div>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenTaskId(isMenuOpen ? null : task.id);
                              }}
                              className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                              aria-label="Task menu"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>
                            {isMenuOpen && (
                              <div
                                className="absolute right-0 top-8 z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg min-w-[160px] py-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => handleEditTask(task)}
                                  className="w-full px-3 py-2 text-xs text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                >
                                  Edit Task
                                </button>
                                <button
                                  onClick={() => handleToggleComplete(task.id, task.completed)}
                                  className="w-full px-3 py-2 text-xs text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                >
                                  {task.completed ? 'Mark as Incomplete' : 'Mark as Completed'}
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="w-full px-3 py-2 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                  Delete Task
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {isExpanded && hasDescription && (
                          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                            <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Description:
                            </p>
                            <p className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                              {task.description}
                            </p>
                          </div>
                        )}
                        {hasDescription && !isExpanded && (
                          <button
                            onClick={() => toggleTaskExpansion(task.id)}
                            className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                          >
                            ▼ Show description
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">No tasks for this date</p>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Click "Add Task" to create one</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Task Modal */}
      {isClient && isAddModalOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed top-0 right-0 bottom-0 left-64 bg-neutral-900/75 dark:bg-black/75 backdrop-blur-md z-[120] transition-all duration-300"
            onClick={() => {
              setIsAddModalOpen(false);
              setEditingTask(null);
              setEntryTitle('');
              setEntryDescription('');
              setScheduledDate(activeDate);
            }}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="fixed top-0 right-0 bottom-0 left-64 z-[130] flex items-center justify-center">
            <div
              className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-5 w-full max-w-md mx-4 border border-neutral-200 dark:border-neutral-700 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {editingTask ? 'Edit Task' : 'Create Task'}
                </h3>
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingTask(null);
                    setEntryTitle('');
                    setEntryDescription('');
                    setScheduledDate(activeDate);
                  }}
                  className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Task Date (Read-only) */}
              <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-700/60 rounded-lg border border-neutral-200 dark:border-neutral-600">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  Task Date
                </label>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {formatDate(scheduledDate)}
                </p>
              </div>

              {/* Task Title */}
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Task Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="Enter task title..."
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700/60 border border-neutral-200 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white mb-3 focus:outline-none focus:ring-1 focus:ring-primary/50"
                autoFocus
              />

              {/* Task Description */}
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Task Description <span className="text-neutral-400">(Optional)</span>
              </label>
              <textarea
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                placeholder="Add additional details about this task..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700/60 border border-neutral-200 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white mb-4 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingTask(null);
                    setEntryTitle('');
                    setEntryDescription('');
                    setScheduledDate(activeDate);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTask}
                  disabled={!entryTitle.trim() || isAdding}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  {isAdding ? (editingTask ? 'Saving...' : 'Creating...') : (editingTask ? 'Save' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default TodoTaskWidget;
