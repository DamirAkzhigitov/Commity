import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordUsageInput): Promise<void> {
    await this.prisma.usageEvent.create({
      data: {
        userId: input.userId,
        feature: input.feature,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCostUsd: new Prisma.Decimal(input.estimatedCostUsd),
      },
    });
  }

  async getMonthlyUsage(userId: string) {
    const events = await this.prisma.usageEvent.findMany({
      where: { userId },
    });

    return {
      userId,
      messages: events.filter((event) => event.feature === 'chat').length,
      tokens: events.reduce((sum, event) => sum + event.inputTokens + event.outputTokens, 0),
      estimatedCostUsd: events.reduce(
        (sum, event) => sum + Number(event.estimatedCostUsd),
        0,
      ),
    };
  }
}
