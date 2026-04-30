/**
 * Load test env before Prisma / AppModule initialize.
 */
import * as path from 'node:path';
import { config } from 'dotenv';

const envPath = path.resolve(__dirname, '../.env');
config({ path: envPath });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://pa:pa@localhost:5432/personal_assistant';
}

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://placeholder.supabase.co';
process.env.SUPABASE_JWT_AUD = process.env.SUPABASE_JWT_AUD ?? 'authenticated';
