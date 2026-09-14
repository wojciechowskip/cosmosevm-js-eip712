import { describe, it, expect } from 'vitest';

import { buildGrantsTypedData } from '../src/buildGrantsTypedData';
import {
  FIXTURE_PARAMS,
  FIXTURE_SIGN_CONTEXT,
  FIXTURE_CHAIN,
  FIXTURE_EXPECTED_TYPED_DATA,
  DEDUP_FIXTURE_PARAMS,
  DEDUP_FIXTURE_EXPECTED_TYPED_DATA,
} from './fixtures/grantsFixture';

describe('buildGrantsTypedData', () => {
  it('matches the typedData captured live from a reference implementation against KiiChain mainnet, byte for byte', () => {
    const result = buildGrantsTypedData(FIXTURE_PARAMS, FIXTURE_SIGN_CONTEXT, FIXTURE_CHAIN);
    expect(result).toEqual(FIXTURE_EXPECTED_TYPED_DATA);
  });

  it('dedupes two genericAuthorization grants onto the same generated type names, matching cosmos/evm observed behavior', () => {
    const result = buildGrantsTypedData(DEDUP_FIXTURE_PARAMS, FIXTURE_SIGN_CONTEXT, FIXTURE_CHAIN);
    expect(result).toEqual(DEDUP_FIXTURE_EXPECTED_TYPED_DATA);
  });
});
