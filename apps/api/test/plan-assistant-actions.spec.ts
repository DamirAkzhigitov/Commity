import { planAssistantActions } from '../src/assistant/plan-assistant-actions';

describe('planAssistantActions', () => {
  it('returns no proposals for greeting-style messages', () => {
    expect(planAssistantActions('Hello')).toEqual([]);
    expect(planAssistantActions('hi')).toEqual([]);
    expect(planAssistantActions('Hey there!')).toEqual([]);
    expect(planAssistantActions('Good morning')).toEqual([]);
    expect(planAssistantActions('thanks')).toEqual([]);
    expect(planAssistantActions('thank you')).toEqual([]);
  });

  it('returns create_task for a bare errand-style line', () => {
    const out = planAssistantActions('buy milk');
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('create_task');
    expect(out[0].payload).toMatchObject({
      title: 'buy milk',
      priority: 'medium',
    });
  });

  it('returns create_task for explicit task creation phrasing', () => {
    const out = planAssistantActions('Please create a task to call the dentist');
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('create_task');
  });

  it('returns create_task for "task to …" phrasing', () => {
    const out = planAssistantActions('task to renew passport');
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('create_task');
  });

  it('suppresses implicit tasks for an ambiguous planning question', () => {
    expect(planAssistantActions('What should I eat for lunch?')).toEqual([]);
  });

  it('still proposes reminder when remind intent is present', () => {
    const out = planAssistantActions('remind me to water plants at 6pm');
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('schedule_reminder');
  });

  it('proposes schedule_reminder for schedule+reminder phrasing', () => {
    const out = planAssistantActions('schedule a reminder to call Kim tomorrow');
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('schedule_reminder');
  });

  it('proposes delete_item when remove/delete intent is present', () => {
    const out = planAssistantActions('remove all tasks');
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('delete_item');
    expect(out[0]).toMatchObject({
      payload: { kind: 'task', localId: 'local_item_pending_selection' },
    });
  });
});
