import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserSubscriptionStatus } from '@prisma/client';
import { subscriptionStatusSchema } from '@personal-assistant/shared';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';

const createUserBodySchema = z.object({
  id: z.string().min(1),
  email: z.string().email().nullable().optional(),
});

const updateUserBodySchema = z.object({
  email: z.string().email().nullable().optional(),
});

const updateSubscriptionBodySchema = z.object({
  status: subscriptionStatusSchema,
  expiresAt: z.string().datetime().nullable(),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UpdateSubscriptionBody = z.infer<typeof updateSubscriptionBodySchema>;

@Injectable()
export class DevAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private parseOrThrow<T>(schema: z.ZodSchema<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  async createUser(input: unknown) {
    const body = this.parseOrThrow(createUserBodySchema, input);
    return this.prisma.user.create({
      data: {
        id: body.id,
        email: body.email ?? null,
      },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateUser(userId: string, input: unknown) {
    const body = this.parseOrThrow(updateUserBodySchema, input);
    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(Object.prototype.hasOwnProperty.call(body, 'email') ? { email: body.email ?? null } : {}),
      },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(userId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException(`User ${userId} not found.`);
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true, userId };
  }

  async setSubscription(userId: string, input: unknown) {
    const body = this.parseOrThrow(updateSubscriptionBodySchema, input);
    const status = body.status as UserSubscriptionStatus;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: status,
        subscriptionExpiresAt: expiresAt,
      },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
