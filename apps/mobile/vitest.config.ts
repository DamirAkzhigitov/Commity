import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@personal-assistant/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      'expo-sqlite': path.resolve(__dirname, 'test/stubs/expo-sqlite.ts'),
      'expo-crypto': path.resolve(__dirname, 'test/stubs/expo-crypto.ts'),
    },
  },
});
