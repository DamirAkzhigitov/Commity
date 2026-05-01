import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseJwtVerifierService } from '../src/auth/supabase-jwt-verifier.service';
import { PrismaService } from '../src/prisma/prisma.service';

const reqId = 'c2b3e4a1-7f0d-4c2a-9e1b-11aa22bb33cc';

describe('API auth, quota, usage (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseJwtVerifierService)
      .useValue({
        verifyJwt: jest.fn().mockImplementation(async (token: string) => {
          if (token === 'bad-token') {
            throw new UnauthorizedException('Invalid or expired token.');
          }
          return { sub: 'e2e-user-1', email: 'e2e@test.local' };
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.usageEvent.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.user.deleteMany();
  });

  it('GET /health is public', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /assistant/chat without Authorization returns 401', async () => {
    await request(app.getHttpServer())
      .post('/assistant/chat')
      .send({ clientRequestId: reqId, message: 'hi' })
      .expect(401);
  });

  it('POST /assistant/chat with invalid JWT returns 401', async () => {
    await request(app.getHttpServer())
      .post('/assistant/chat')
      .set('Authorization', 'Bearer bad-token')
      .send({ clientRequestId: reqId, message: 'hi' })
      .expect(401);
  });

  it('rejects spoofed userId in body (whitelist)', async () => {
    await request(app.getHttpServer())
      .post('/assistant/chat')
      .set('Authorization', 'Bearer good')
      .send({ clientRequestId: reqId, message: 'hi', userId: 'attacker' })
      .expect(400);
  });

  it('POST /assistant/chat rejects invalid context shape with 400', async () => {
    await request(app.getHttpServer())
      .post('/assistant/chat')
      .set('Authorization', 'Bearer good')
      .send({
        clientRequestId: reqId,
        message: 'hi',
        context: { schemaVersion: 'not-a-number', items: [] },
      })
      .expect(400);
  });

  it('returns 403 when trial message cap is reached before AI', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.user.create({
      data: {
        id: 'e2e-user-1',
        email: 'e2e@test.local',
        createdAt: past,
        updatedAt: past,
      },
    });
    await prisma.usageEvent.createMany({
      data: Array.from({ length: 25 }, () => ({
        userId: 'e2e-user-1',
        feature: 'chat',
        model: 'mock',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
      })),
    });

    await request(app.getHttpServer())
      .post('/assistant/chat')
      .set('Authorization', 'Bearer good')
      .send({ clientRequestId: reqId, message: 'one more' })
      .expect(403);

    const count = await prisma.usageEvent.count({ where: { userId: 'e2e-user-1' } });
    expect(count).toBe(25);
  });

  it('returns 403 when subscribed user exceeds monthly message quota', async () => {
    await prisma.user.create({
      data: {
        id: 'e2e-user-1',
        email: 'e2e@test.local',
      },
    });
    await prisma.subscription.create({
      data: {
        userId: 'e2e-user-1',
        provider: 'google_play',
        productId: 'plus_monthly',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      },
    });
    const planLimit = 1000;
    await prisma.usageEvent.createMany({
      data: Array.from({ length: planLimit }, () => ({
        userId: 'e2e-user-1',
        feature: 'chat',
        model: 'mock',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
      })),
    });

    await request(app.getHttpServer())
      .post('/assistant/chat')
      .set('Authorization', 'Bearer good')
      .send({ clientRequestId: reqId, message: 'over limit' })
      .expect(403);

    expect(await prisma.usageEvent.count({ where: { userId: 'e2e-user-1' } })).toBe(planLimit);
  });

  it(
    'persists non-content usage row on chat success without storing message bodies',
    async () => {
      const res = await request(app.getHttpServer())
        .post('/assistant/chat')
        .set('Authorization', 'Bearer good')
        .send({ clientRequestId: reqId, message: 'hello quota world' })
        .expect(200);

      expect(['mock', 'openai']).toContain(res.body.mode);
      expect(res.body.clientRequestId).toBe(reqId);
      expect(Array.isArray(res.body.proposals)).toBe(true);

      const rows = await prisma.usageEvent.findMany({ where: { userId: 'e2e-user-1' } });
      expect(rows).toHaveLength(1);
      expect(rows[0].feature).toBe('chat');
      if (res.body.mode === 'mock') {
        expect(rows[0].model).toBe('mock');
        expect(rows[0].inputTokens).toBe(0);
        expect(rows[0].outputTokens).toBe(0);
        expect(Number(rows[0].estimatedCostUsd)).toBe(0);
      } else {
        expect(rows[0].model).toBe('gpt-4.1-mini');
        expect(Number(rows[0].inputTokens)).toBeGreaterThanOrEqual(0);
        expect(Number(rows[0].outputTokens)).toBeGreaterThanOrEqual(0);
        expect(Number(rows[0].estimatedCostUsd)).toBeGreaterThanOrEqual(0);
      }
      const json = JSON.stringify(rows[0]);
      expect(json).not.toContain('hello quota world');
    },
    20000,
  );
});
