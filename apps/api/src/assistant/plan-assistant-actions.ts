import { randomUUID } from 'crypto';
import type { AssistantActionProposal } from '@personal-assistant/shared';

/** Patterns for greetings, acknowledgements, and light small talk — no proposals. */
function isLikelyConversationalOnly(trimmed: string): boolean {
  const t = trimmed.toLowerCase().replace(/\s+/g, ' ');
  if (t.length === 0) return true;

  const patterns: RegExp[] = [
    /^hello[!?.]*$/,
    /^hi[!?.]*$/,
    /^hey[!?.]*$/,
    /^hey there[!?.]*$/,
    /^hi there[!?.]*$/,
    /^hello there[!?.]*$/,
    /^good (morning|afternoon|evening)[!?.]*$/,
    /^morning[!?.]*$/,
    /^evening[!?.]*$/,
    /^thanks?!?$/,
    /^thank you[!?.]*$/,
    /^thx[!?.]*$/,
    /^ty[!?]?$/,
    /^cheers[!?.]*$/,
    /^(ok|okay|k|kk|sure|yep|yeah|yup|ya)[!?.]*$/,
    /^got it[!?.]*$/,
    /^sounds good[!?.]*$/,
    /^will do[!?.]*$/,
    /^alright[!?.]*$/,
    /^nice[!?.]*$/,
    /^cool[!?.]*$/,
    /^great[!?.]*$/,
    /^no problem[!?.]*$/,
    /^np[!?.]*$/,
    /^bye[!?.]*$/,
    /^goodbye[!?.]*$/,
    /^see (you|ya)[!?.]*$/,
    /^what'?s up\??$/,
    /^sup\??$/,
    /^howdy[!?.]*$/,
    /^yo[!?.]*$/,
    /^how are you\??$/,
    /^how('?ve| have) you been\??$/,
    /^how('?s| is) it going\??$/,
    /^how('?s| is) your day\??$/,
    /^long time no see[!?.]*$/,
  ];

  if (patterns.some((r) => r.test(t))) return true;

  // Short filler / emoji-only style (no letters)
  if (!/[a-z]/i.test(t)) return true;

  return false;
}

const EXPLICIT_TASK_PHRASE =
  /\b(create|add|make|start|put)\s+(a\s+)?(new\s+)?(task|todo|to-?do)\b/i;
const TASK_FOR_PHRASE = /\b(task|todo|to-?do)\s+(to|for)\s+\S+/i;
const EXPLICIT_LIST_PHRASE =
  /\b(put|add)\b[\s\S]{0,120}\b(on my list|to my list|on my task list)\b/i;

function hasExplicitTaskIntent(t: string): boolean {
  return (
    EXPLICIT_TASK_PHRASE.test(t) ||
    TASK_FOR_PHRASE.test(t) ||
    EXPLICIT_LIST_PHRASE.test(t)
  );
}

/** Meta questions and vague questions — suppress implicit create_task, not keyword branches. */
function shouldSuppressImplicitTaskProposal(trimmed: string): boolean {
  const lower = trimmed.toLowerCase();

  if (/^how (do i|can i|should i|to|does|is)\b/m.test(lower)) return true;
  if (/^what (can you|are you|do you|is your|does)\b/m.test(lower)) return true;
  if (/^who are you\b|^help\??$|^help me\??$/i.test(trimmed)) return true;

  if (/\bwhat should (i|we)\b/i.test(lower) && trimmed.endsWith('?')) return true;

  if (trimmed.endsWith('?')) {
    const hasConcreteTaskCue =
      hasExplicitTaskIntent(trimmed) ||
      /\b(buy|get|call|email|send|pay|book|order|pick up|remind|schedule)\b/i.test(
        trimmed,
      ) ||
      /\b(finish|complete|submit|file|draft|write|review)\b/i.test(trimmed) ||
      /\b(due|deadline|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today))\b/i.test(
        lower,
      );
    if (!hasConcreteTaskCue) return true;
  }

  return false;
}

const SCHEDULE_REMINDERISH =
  /\bschedule\b.*\b(remind|reminder)\b|\b(remind|reminder)\b.*\bschedule\b|\bschedule\s+(a|an)\s+reminder\b/i;

export function planAssistantActions(message: string): AssistantActionProposal[] {
  const trimmed = message.trim();
  if (trimmed.length === 0) return [];

  if (isLikelyConversationalOnly(trimmed)) {
    return [];
  }

  const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
  const id = () => randomUUID();

  if (normalized.includes('delete') || normalized.includes('remove')) {
    return [
      {
        proposalId: id(),
        type: 'delete_item',
        confirmationTier: 'requires_confirmation',
        payload: {
          localId: 'local_item_pending_selection',
          kind: 'task',
        },
      },
    ];
  }

  if (normalized.includes('update') || normalized.includes('rename')) {
    return [
      {
        proposalId: id(),
        type: 'update_item',
        confirmationTier: 'requires_confirmation',
        payload: {
          localId: 'local_item_pending_selection',
          kind: 'task',
          updates: { titleOrLabel: trimmed.slice(0, 512) },
        },
      },
    ];
  }

  if (normalized.includes('goal')) {
    return [
      {
        proposalId: id(),
        type: 'create_task',
        confirmationTier: 'requires_confirmation',
        payload: {
          title: trimmed.slice(0, 512),
          description: 'Outcome-oriented task (formerly framed as a goal).',
          priority: 'high',
        },
      },
    ];
  }

  if (normalized.includes('remind') || SCHEDULE_REMINDERISH.test(trimmed)) {
    return [
      {
        proposalId: id(),
        type: 'schedule_reminder',
        confirmationTier: 'requires_confirmation',
        payload: {
          title: trimmed.slice(0, 512),
          text: trimmed.slice(0, 2000),
          remindAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      },
    ];
  }

  if (normalized.includes('note')) {
    return [
      {
        proposalId: id(),
        type: 'upsert_document',
        confirmationTier: 'requires_confirmation',
        payload: {
          taskLocalId: 'local_task_pending_selection',
          title: 'Captured note',
          bodySnippet: trimmed.slice(0, 2000),
        },
      },
    ];
  }

  if (normalized.includes('subtask') || normalized.includes('sub-item')) {
    return [
      {
        proposalId: id(),
        type: 'create_subitem',
        confirmationTier: 'requires_confirmation',
        payload: {
          taskLocalId: 'local_task_pending_selection',
          title: trimmed.slice(0, 512),
        },
      },
    ];
  }

  if (hasExplicitTaskIntent(trimmed)) {
    return [
      {
        proposalId: id(),
        type: 'create_task',
        confirmationTier: 'requires_confirmation',
        payload: {
          title: trimmed,
          priority: 'medium',
        },
      },
    ];
  }

  if (shouldSuppressImplicitTaskProposal(trimmed)) {
    return [];
  }

  if (trimmed.length < 3) {
    return [];
  }

  return [
    {
      proposalId: id(),
      type: 'create_task',
      confirmationTier: 'requires_confirmation',
      payload: {
        title: trimmed,
        priority: 'medium',
      },
    },
  ];
}
