import { describe, it, expect } from 'vitest';
import { MsgGrant } from 'cosmjs-types/cosmos/authz/v1beta1/tx';
import { GenericAuthorization } from 'cosmjs-types/cosmos/authz/v1beta1/authz';
import { SendAuthorization } from 'cosmjs-types/cosmos/bank/v1beta1/authz';
import { MsgGrantAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/tx';
import { BasicAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant';

import {
  buildOptimizeGrantsAnyMessages,
  encodeEthsecp256k1PubKey,
  REDELEGATE_MSG_TYPE_URL,
  ETHSECP256K1_PUBKEY_TYPE_URL,
} from '../src/protobufMessages';
import { FIXTURE_PARAMS } from './fixtures/optimizeGrantsFixture';

describe('buildOptimizeGrantsAnyMessages', () => {
  it('produces 3 messages that decode back to the expected values', () => {
    const [msg0, msg1, msg2] = buildOptimizeGrantsAnyMessages(FIXTURE_PARAMS);

    expect(msg0.typeUrl).toBe('/cosmos.authz.v1beta1.MsgGrant');
    const decoded0 = MsgGrant.decode(msg0.value);
    expect(decoded0.granter).toBe(FIXTURE_PARAMS.granterAddress);
    expect(decoded0.grantee).toBe(FIXTURE_PARAMS.granteeAddress);
    expect(decoded0.grant.authorization?.typeUrl).toBe('/cosmos.authz.v1beta1.GenericAuthorization');
    const auth0 = GenericAuthorization.decode(decoded0.grant.authorization!.value);
    expect(auth0.msg).toBe(REDELEGATE_MSG_TYPE_URL);

    expect(msg1.typeUrl).toBe('/cosmos.authz.v1beta1.MsgGrant');
    const decoded1 = MsgGrant.decode(msg1.value);
    expect(decoded1.grant.authorization?.typeUrl).toBe('/cosmos.bank.v1beta1.SendAuthorization');
    const auth1 = SendAuthorization.decode(decoded1.grant.authorization!.value);
    expect(auth1.spendLimit).toEqual([
      { denom: 'akii', amount: FIXTURE_PARAMS.transferSpendLimitAkii },
    ]);

    expect(msg2.typeUrl).toBe('/cosmos.feegrant.v1beta1.MsgGrantAllowance');
    const decoded2 = MsgGrantAllowance.decode(msg2.value);
    expect(decoded2.allowance?.typeUrl).toBe('/cosmos.feegrant.v1beta1.BasicAllowance');
    const allowance = BasicAllowance.decode(decoded2.allowance!.value);
    expect(allowance.spendLimit).toEqual([]);
  });
});

describe('encodeEthsecp256k1PubKey', () => {
  it('round-trips a 33-byte compressed key through the hand-encoded Any', () => {
    const key = new Uint8Array(33).fill(7);
    const any = encodeEthsecp256k1PubKey(key);
    expect(any.typeUrl).toBe(ETHSECP256K1_PUBKEY_TYPE_URL);
    // message PubKey { bytes key = 1; } -- decode by hand the same way: tag
    // byte (field 1, wire type 2) then a length varint then the raw bytes.
    expect(any.value[0]).toBe((1 << 3) | 2);
    expect(any.value[1]).toBe(33);
    expect(any.value.slice(2)).toEqual(key);
  });
});
