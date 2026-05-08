import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DevAdminService } from '../src/dev-admin/dev-admin.service';

describe('DevAdminService', () => {
  let prisma: {
    user: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let service: DevAdminService;

  beforeEach(() => {
    prisma = {
      user: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    service = new DevAdminService(prisma as never);
  });

  it('creates a user with required id', async () => {
    const user = { id: 'qa_user', email: null, subscriptionStatus: 'FREE' };
    prisma.user.create.mockResolvedValue(user);
    await expect(service.createUser({ id: 'qa_user' })).resolves.toEqual(user);
  });

  it('rejects invalid email on create', async () => {
    await expect(service.createUser({ id: 'x', email: 'bad-email' })).rejects.toThrow(BadRequestException);
  });

  it('updates an existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', email: 'qa@example.com' });
    await expect(service.updateUser('u1', { email: 'qa@example.com' })).resolves.toEqual({
      id: 'u1',
      email: 'qa@example.com',
    });
  });

  it('throws on updating missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.updateUser('missing', { email: 'qa@example.com' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('sets subscription status and expiresAt', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    prisma.user.update.mockResolvedValue({ id: 'u2', subscriptionStatus: 'ACTIVE' });
    await expect(
      service.setSubscription('u2', { status: 'ACTIVE', expiresAt: '2026-12-31T23:59:59.000Z' }),
    ).resolves.toEqual({
      id: 'u2',
      subscriptionStatus: 'ACTIVE',
    });
  });

  it('deletes existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u3' });
    prisma.user.delete.mockResolvedValue({});
    await expect(service.deleteUser('u3')).resolves.toEqual({ deleted: true, userId: 'u3' });
  });
});
