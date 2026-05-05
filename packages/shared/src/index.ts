import { z } from 'zod';

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type Priority = z.infer<typeof prioritySchema>;

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: taskStatusSchema.default('todo'),
  priority: prioritySchema.default('medium'),
  dueAt: z.string().datetime().optional(),
  goalId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Task = z.infer<typeof taskSchema>;

export const noteSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  body: z.string(),
  summary: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Note = z.infer<typeof noteSchema>;

export const reminderSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  remindAt: z.string().datetime(),
  taskId: z.string().optional(),
  noteId: z.string().optional(),
  deliveredAt: z.string().datetime().optional(),
});
export type Reminder = z.infer<typeof reminderSchema>;

export const goalSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  motivation: z.string().optional(),
  targetDate: z.string().datetime().optional(),
  active: z.boolean().default(true),
});
export type Goal = z.infer<typeof goalSchema>;

export const memoryItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['conversation_summary', 'task', 'note', 'goal', 'preference']),
  content: z.string().min(1),
  importance: z.number().min(0).max(1).default(0.5),
  createdAt: z.string().datetime(),
});
export type MemoryItem = z.infer<typeof memoryItemSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export * from './assistant-contracts.js';
export * from './billing.js';
export * from './execution-log-format.js';

export const subscriptionPlanSchema = z.object({
  id: z.enum(['free', 'plus', 'pro']),
  name: z.string(),
  monthlyMessageLimit: z.number().int().nonnegative(),
  monthlyTokenLimit: z.number().int().nonnegative(),
  memoryEnabled: z.boolean(),
  proactiveRemindersEnabled: z.boolean(),
});
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyMessageLimit: 25,
    monthlyTokenLimit: 50000,
    memoryEnabled: false,
    proactiveRemindersEnabled: false,
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyMessageLimit: 1000,
    monthlyTokenLimit: 2000000,
    memoryEnabled: true,
    proactiveRemindersEnabled: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyMessageLimit: 5000,
    monthlyTokenLimit: 10000000,
    memoryEnabled: true,
    proactiveRemindersEnabled: true,
  },
];
