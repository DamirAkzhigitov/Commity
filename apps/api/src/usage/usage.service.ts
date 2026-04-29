import { Injectable } from '@nestjs/common';

export type UsageFeature = 'chat' | 'memory_embedding' | 'proactive_reminder';

export interface RecordUsageInput {
  userId: string;
  feature: UsageFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

@Injectable()
export class UsageService {
  private readonly usageEvents: RecordUsageInput[] = [];

  record(input: RecordUsageInput) {
    this.usageEvents.push(input);
    return input;
  }

  getMonthlyUsage(userId: string) {
    const events = this.usageEvents.filter((event) => event.userId === userId);

    return {
      userId,
      messages: events.filter((event) => event.feature === 'chat').length,
      tokens: events.reduce((sum, event) => sum + event.inputTokens + event.outputTokens, 0),
      estimatedCostUsd: events.reduce((sum, event) => sum + event.estimatedCostUsd, 0),
    };
  }
}
