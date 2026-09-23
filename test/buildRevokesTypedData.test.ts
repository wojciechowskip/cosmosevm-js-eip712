import { describe, expect, it } from 'vitest';

import { buildRevokesTypedData } from '../src/buildGrantsTypedData';
import { KII_MAINNET, RevokesParams, SignContext } from '../src/types';
import { REVOKES_FIXTURE_TYPED_DATA } from './fixtures/revokesFixture';

// Exactly the inputs kii-poc-evm-authz/revokedump used to produce the
// fixture -- same granter, grantee, msg type URLs and order, same fee, gas,
// account number and sequence. Any drift here makes the comparison
// meaningless rather than failing loudly, so keep them in lockstep with
// that program's constants.
const PARAMS: RevokesParams = {
  granterAddress: 'kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh',
  granteeAddress: 'kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc',
  revokes: [
    { kind: 'revokeAuthorization', msgTypeUrl: '/cosmos.staking.v1beta1.MsgDelegate' },
    { kind: 'revokeAuthorization', msgTypeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate' },
    {
      kind: 'revokeAuthorization',
      msgTypeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
    },
    { kind: 'revokeAuthorization', msgTypeUrl: '/cosmos.bank.v1beta1.MsgSend' },
    { kind: 'revokeFeeGrant' },
  ],
};

const SIGN_CONTEXT: SignContext = {
  accountNumber: '1',
  sequence: '1',
  gasLimit: '400000',
  feeAmountAkii: '2000000000000000',
};

describe('buildRevokesTypedData', () => {
  it('matches cosmos/evm WrapTxToTypedData byte for byte', () => {
    const built = buildRevokesTypedData(PARAMS, SIGN_CONTEXT, KII_MAINNET);

    expect(JSON.parse(JSON.stringify(built))).toEqual(
      JSON.parse(JSON.stringify(REVOKES_FIXTURE_TYPED_DATA))
    );
  });

  it('puts msg_type_url BEFORE granter and grantee', () => {
    // Called out on its own because it is the one field order nobody would
    // reproduce from the proto definition (granter=1, grantee=2,
    // msg_type_url=3) or from alphabetical sorting. A refactor that
    // "tidies" this breaks every signature.
    const built = buildRevokesTypedData(PARAMS, SIGN_CONTEXT, KII_MAINNET);

    expect(built.types.TypeValue0.map((f) => f.name)).toEqual([
      'msg_type_url',
      'granter',
      'grantee',
    ]);
  });

  it('collapses repeated MsgRevoke onto one type definition', () => {
    const built = buildRevokesTypedData(PARAMS, SIGN_CONTEXT, KII_MAINNET);
    const tx = built.types.Tx;

    // Four revokes, one shared type -- the same structural-dedup rule the
    // grants path relies on.
    expect(tx.filter((f) => f.type === 'TypeMsgRevoke0')).toHaveLength(4);
    expect(built.types.TypeMsgRevoke1).toBeUndefined();
    // The feegrant revoke is a different envelope AND a different value
    // shape, so it continues the global TypeValue counter at 1.
    expect(built.types.TypeMsgRevokeAllowance0).toBeDefined();
    expect(built.types.TypeValue1.map((f) => f.name)).toEqual(['granter', 'grantee']);
  });

  it('does not emit an expiration anywhere', () => {
    const built = buildRevokesTypedData(PARAMS, SIGN_CONTEXT, KII_MAINNET);

    expect(JSON.stringify(built)).not.toContain('expiration');
  });
});
