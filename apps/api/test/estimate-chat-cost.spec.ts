import { ConfigService } from '@nestjs/config';
import { estimateChatCostUsd } from '../src/assistant/assistant.service';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('estimateChatCostUsd', () => {
  it('returns zero for the mock model regardless of token counts', () => {
    const config = makeConfig({});
    expect(estimateChatCostUsd('mock', 1000, 1000, config)).toBe(0);
  });

  it('uses configured numeric rates', () => {
    const config = makeConfig({
      OPENAI_INPUT_USD_PER_MILLION: '1',
      OPENAI_OUTPUT_USD_PER_MILLION: '2',
    });
    const cost = estimateChatCostUsd('gpt-4.1-mini', 1_000_000, 1_000_000, config);
    expect(cost).toBeCloseTo(3, 6);
  });

  it('falls back to defaults when rates are unset', () => {
    const config = makeConfig({});
    const cost = estimateChatCostUsd('gpt-4.1-mini', 1_000_000, 1_000_000, config);
    expect(cost).toBeCloseTo(0.15 + 0.6, 6);
  });

  it('falls back to defaults when rates are non-numeric strings (no NaN leak)', () => {
    const config = makeConfig({
      OPENAI_INPUT_USD_PER_MILLION: 'abc',
      OPENAI_OUTPUT_USD_PER_MILLION: 'NaN',
    });
    const cost = estimateChatCostUsd('gpt-4.1-mini', 1_000_000, 1_000_000, config);
    expect(Number.isFinite(cost)).toBe(true);
    expect(cost).toBeCloseTo(0.15 + 0.6, 6);
  });

  it('falls back to defaults when rates are negative', () => {
    const config = makeConfig({
      OPENAI_INPUT_USD_PER_MILLION: '-1',
      OPENAI_OUTPUT_USD_PER_MILLION: '-2',
    });
    const cost = estimateChatCostUsd('gpt-4.1-mini', 1_000_000, 1_000_000, config);
    expect(cost).toBeCloseTo(0.15 + 0.6, 6);
  });

  it('falls back to defaults when rates are empty strings', () => {
    const config = makeConfig({
      OPENAI_INPUT_USD_PER_MILLION: '',
      OPENAI_OUTPUT_USD_PER_MILLION: '',
    });
    const cost = estimateChatCostUsd('gpt-4.1-mini', 1_000_000, 1_000_000, config);
    expect(cost).toBeCloseTo(0.15 + 0.6, 6);
  });
});
