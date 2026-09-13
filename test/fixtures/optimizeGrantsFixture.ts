import { OptimizeGrantsParams, SignContext, ChainConfig, EIP712TypedData } from '../../src/types';

/**
 * Captured VERBATIM from a reference Go implementation's typed-data output,
 * smoke-tested live against KiiChain mainnet (real account 50203, sequence
 * advanced to 1 after a prior real broadcast -- see this library's own
 * README for provenance). This is the ground truth this library's typedData
 * construction is verified against.
 */

export const FIXTURE_PARAMS: OptimizeGrantsParams = {
  granterAddress: 'kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh',
  granteeAddress: 'kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc',
  transferSpendLimitAkii: '1000000000000000',
  // Reuses the granter address as the allow_list target -- what a live
  // typed-data dry-run against cosmos/evm's WrapTxToTypedData was actually
  // run with (2026-09-13) to confirm allow_list's schema; any valid bech32
  // address exercises the same shape.
  transferGrantAllowAddress: 'kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh',
  expirySeconds: 1820000000, // -> 2027-09-03T19:33:20Z
};

export const FIXTURE_SIGN_CONTEXT: SignContext = {
  accountNumber: '50203',
  sequence: '1',
  gasLimit: '400000',
  feeAmountAkii: '136000000000000',
};

export const FIXTURE_CHAIN: ChainConfig = {
  cosmosChainId: 'kiichain_1783-1',
  evmChainId: 1783,
  lcdUrl: 'https://lcd.kiivalidator.com',
};

export const FIXTURE_EXPECTED_TYPED_DATA: EIP712TypedData = {
  types: {
    Coin: [
      { name: 'denom', type: 'string' },
      { name: 'amount', type: 'string' },
    ],
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'string' },
      { name: 'salt', type: 'string' },
    ],
    Fee: [
      { name: 'amount', type: 'Coin[]' },
      { name: 'gas', type: 'string' },
    ],
    Tx: [
      { name: 'account_number', type: 'string' },
      { name: 'chain_id', type: 'string' },
      { name: 'fee', type: 'Fee' },
      { name: 'memo', type: 'string' },
      { name: 'sequence', type: 'string' },
      { name: 'msg0', type: 'TypeMsgGrant0' },
      { name: 'msg1', type: 'TypeMsgGrant1' },
      { name: 'msg2', type: 'TypeMsgGrantAllowance0' },
    ],
    TypeMsgGrant0: [
      { name: 'value', type: 'TypeValue0' },
      { name: 'type', type: 'string' },
    ],
    TypeMsgGrant1: [
      { name: 'value', type: 'TypeValue1' },
      { name: 'type', type: 'string' },
    ],
    TypeMsgGrantAllowance0: [
      { name: 'value', type: 'TypeValue2' },
      { name: 'type', type: 'string' },
    ],
    TypeValue0: [
      { name: 'granter', type: 'string' },
      { name: 'grantee', type: 'string' },
      { name: 'grant', type: 'TypeValueGrant0' },
    ],
    TypeValue1: [
      { name: 'granter', type: 'string' },
      { name: 'grantee', type: 'string' },
      { name: 'grant', type: 'TypeValueGrant1' },
    ],
    TypeValue2: [
      { name: 'granter', type: 'string' },
      { name: 'grantee', type: 'string' },
      { name: 'allowance', type: 'TypeValueAllowance0' },
    ],
    TypeValueAllowance0: [
      { name: 'value', type: 'TypeValueAllowanceValue0' },
      { name: 'type', type: 'string' },
    ],
    TypeValueAllowanceValue0: [{ name: 'spend_limit', type: 'string[]' }],
    TypeValueGrant0: [
      { name: 'expiration', type: 'string' },
      { name: 'authorization', type: 'TypeValueGrantAuthorization0' },
    ],
    TypeValueGrant1: [
      { name: 'expiration', type: 'string' },
      { name: 'authorization', type: 'TypeValueGrantAuthorization1' },
    ],
    TypeValueGrantAuthorization0: [
      { name: 'value', type: 'TypeValueGrantAuthorizationValue0' },
      { name: 'type', type: 'string' },
    ],
    TypeValueGrantAuthorization1: [
      { name: 'value', type: 'TypeValueGrantAuthorizationValue1' },
      { name: 'type', type: 'string' },
    ],
    TypeValueGrantAuthorizationValue0: [{ name: 'msg', type: 'string' }],
    TypeValueGrantAuthorizationValue1: [
      { name: 'spend_limit', type: 'TypeValueGrantAuthorizationValueSpendLimit0[]' },
      { name: 'allow_list', type: 'string[]' },
    ],
    TypeValueGrantAuthorizationValueSpendLimit0: [
      { name: 'denom', type: 'string' },
      { name: 'amount', type: 'string' },
    ],
  },
  primaryType: 'Tx',
  domain: {
    name: 'Cosmos Web3',
    version: '1.0.0',
    chainId: '0x6f7',
    verifyingContract: 'cosmos',
    salt: '0',
  },
  message: {
    account_number: '50203',
    chain_id: 'kiichain_1783-1',
    sequence: '1',
    memo: '',
    fee: {
      amount: [{ denom: 'akii', amount: '136000000000000' }],
      gas: '400000',
    },
    msg0: {
      type: 'cosmos-sdk/MsgGrant',
      value: {
        granter: 'kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh',
        grantee: 'kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc',
        grant: {
          authorization: {
            type: 'cosmos-sdk/GenericAuthorization',
            value: { msg: '/cosmos.staking.v1beta1.MsgBeginRedelegate' },
          },
          expiration: '2027-09-03T19:33:20Z',
        },
      },
    },
    msg1: {
      type: 'cosmos-sdk/MsgGrant',
      value: {
        granter: 'kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh',
        grantee: 'kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc',
        grant: {
          authorization: {
            type: 'cosmos-sdk/SendAuthorization',
            value: {
              spend_limit: [{ denom: 'akii', amount: '1000000000000000' }],
              allow_list: ['kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh'],
            },
          },
          expiration: '2027-09-03T19:33:20Z',
        },
      },
    },
    msg2: {
      type: 'cosmos-sdk/MsgGrantAllowance',
      value: {
        granter: 'kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh',
        grantee: 'kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc',
        allowance: {
          type: 'cosmos-sdk/BasicAllowance',
          value: { spend_limit: [] },
        },
      },
    },
  },
};
