"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionPlans = exports.subscriptionPlanSchema = exports.chatMessageSchema = exports.memoryItemSchema = exports.goalSchema = exports.reminderSchema = exports.noteSchema = exports.taskSchema = exports.prioritySchema = exports.taskStatusSchema = void 0;
const zod_1 = require("zod");
exports.taskStatusSchema = zod_1.z.enum(['todo', 'in_progress', 'done', 'cancelled']);
exports.prioritySchema = zod_1.z.enum(['low', 'medium', 'high', 'urgent']);
exports.taskSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    status: exports.taskStatusSchema.default('todo'),
    priority: exports.prioritySchema.default('medium'),
    dueAt: zod_1.z.string().datetime().optional(),
    goalId: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.noteSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string().min(1),
    body: zod_1.z.string(),
    summary: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.reminderSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string().min(1),
    remindAt: zod_1.z.string().datetime(),
    taskId: zod_1.z.string().optional(),
    noteId: zod_1.z.string().optional(),
    deliveredAt: zod_1.z.string().datetime().optional(),
});
exports.goalSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string().min(1),
    motivation: zod_1.z.string().optional(),
    targetDate: zod_1.z.string().datetime().optional(),
    active: zod_1.z.boolean().default(true),
});
exports.memoryItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    kind: zod_1.z.enum(['conversation_summary', 'task', 'note', 'goal', 'preference']),
    content: zod_1.z.string().min(1),
    importance: zod_1.z.number().min(0).max(1).default(0.5),
    createdAt: zod_1.z.string().datetime(),
});
exports.chatMessageSchema = zod_1.z.object({
    id: zod_1.z.string(),
    role: zod_1.z.enum(['user', 'assistant', 'system']),
    content: zod_1.z.string().min(1),
    createdAt: zod_1.z.string().datetime(),
});
__exportStar(require("./assistant-contracts.js"), exports);
exports.subscriptionPlanSchema = zod_1.z.object({
    id: zod_1.z.enum(['free', 'plus', 'pro']),
    name: zod_1.z.string(),
    monthlyMessageLimit: zod_1.z.number().int().nonnegative(),
    monthlyTokenLimit: zod_1.z.number().int().nonnegative(),
    memoryEnabled: zod_1.z.boolean(),
    proactiveRemindersEnabled: zod_1.z.boolean(),
});
exports.subscriptionPlans = [
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
