import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  Timestamp,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { TodoTask } from '../lib/types.js';

const TODOS_COLLECTION = 'todos';

/**
 * Convert Firestore Timestamp to ISO string
 */
const timestampToIso = (timestamp: any): string => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date().toISOString();
};

/**
 * Convert Firestore document data to TodoTask
 */
const docToTodoTask = (id: string, data: DocumentData): TodoTask => {
  return {
    id,
    title: data.title || '',
    description: data.description || undefined,
    completed: data.completed || false,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    createdBy: data.createdBy || '',
    scheduledDate: data.scheduledDate || undefined,
  };
};

/**
 * Todo Service - Firestore CRUD operations for todo tasks
 */
export const todoService = {
  /**
   * Create a new todo task
   */
  async create(task: Omit<TodoTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<TodoTask> {
    const todosRef = collection(db, TODOS_COLLECTION);
    const newDocRef = doc(todosRef);
    const now = new Date().toISOString();

    const taskData: any = {
      title: task.title,
      completed: task.completed || false,
      createdBy: task.createdBy,
      createdAt: Timestamp.fromDate(new Date(now)),
      updatedAt: Timestamp.fromDate(new Date(now)),
    };

    if (task.description) {
      taskData.description = task.description;
    }
    if (task.scheduledDate) {
      taskData.scheduledDate = task.scheduledDate;
    }

    await setDoc(newDocRef, taskData);

    return {
      id: newDocRef.id,
      ...task,
      completed: task.completed || false,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Get all todos for a specific user
   */
  async getAll(userId: string): Promise<TodoTask[]> {
    const todosRef = collection(db, TODOS_COLLECTION);
    const q = query(todosRef, where('createdBy', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => docToTodoTask(doc.id, doc.data()));
  },

  /**
   * Get a single todo by ID
   */
  async getById(id: string): Promise<TodoTask | null> {
    const docRef = doc(db, TODOS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docToTodoTask(docSnap.id, docSnap.data());
    }
    return null;
  },

  /**
   * Update an existing todo task
   */
  async update(id: string, updates: Partial<Pick<TodoTask, 'title' | 'description' | 'completed' | 'scheduledDate'>>): Promise<void> {
    const docRef = doc(db, TODOS_COLLECTION, id);
    const updateData: any = {
      updatedAt: Timestamp.fromDate(new Date()),
    };

    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description || null;
    }
    if (updates.completed !== undefined) {
      updateData.completed = updates.completed;
    }
    if (updates.scheduledDate !== undefined) {
      updateData.scheduledDate = updates.scheduledDate || null;
    }

    await updateDoc(docRef, updateData);
  },

  /**
   * Delete a todo task
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, TODOS_COLLECTION, id);
    await deleteDoc(docRef);
  },

  /**
   * Subscribe to real-time updates for todos (filtered by userId)
   */
  subscribe(
    userId: string,
    callback: (todos: TodoTask[]) => void
  ): Unsubscribe {
    const todosRef = collection(db, TODOS_COLLECTION);
    const q = query(todosRef, where('createdBy', '==', userId), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const todos = snapshot.docs.map((doc) => docToTodoTask(doc.id, doc.data()));
      callback(todos);
    }, (error) => {
      console.error('Error in todos subscription:', error);
      callback([]);
    });
  },
};

