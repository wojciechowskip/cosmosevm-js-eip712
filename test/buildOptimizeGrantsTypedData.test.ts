import { describe, it, expect } from 'vitest';

import { buildOptimizeGrantsTypedData } from '../src/buildOptimizeGrantsTypedData';
import {
  FIXTURE_PARAMS,
  FIXTURE_SIGN_CONTEXT,
  FIXTURE_CHAIN,
  FIXTURE_EXPECTED_TYPED_DATA,
} from './fixtures/optimizeGrantsFixture';

describe('buildOptimizeGrantsTypedData', () => {
  it('matches the typedData captured live from polli-eip712-service against KiiChain mainnet, byte for byte', () => {
    const result = buildOptimizeGrantsTypedData(FIXTURE_PARAMS, FIXTURE_SIGN_CONTEXT, FIXTURE_CHAIN);
    expect(result).toEqual(FIXTURE_EXPECTED_TYPED_DATA);
  });
});
