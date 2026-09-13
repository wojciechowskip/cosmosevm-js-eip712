import { OptimizeGrantsParams, SignContext, ChainConfig, EIP712TypedData } from './types';

/**
 * FIXED type schema for the exact 3-message "optimize grants" bundle
 * (staking GenericAuthorization grant, bank SendAuthorization grant,
 * feegrant BasicAllowance), always in that order, always to one grantee.
 *
 * This is NOT a generic Cosmos-message-to-EIP712 encoder -- cosmos/evm's
 * own `eip712.WrapTxToTypedData` (Go, ~1500-2500 LOC across encoding/
 * preprocess/type-mapping files) is that, and porting it was judged not
 * worth the risk for one fixed message shape. Instead, this schema was
 * captured VERBATIM from a reference Go implementation's typed-data output,
 * smoke-tested live against KiiChain mainnet (see
 * test/fixtures/optimizeGrantsFixture.ts for the full captured example:
 * real account 50203, sequence advanced to 1 after a prior real
 * broadcast). If cosmos/evm's type-naming convention ever changes for
 * this exact message combination, this schema needs re-verifying against
 * a fresh captured example -- it will not silently drift, since a mismatch
 * fails signature verification cleanly rather than misbehaving.
 *
 * The type names' numeric suffixes are not arbitrary: cosmos/evm's
 * generator assigns each DISTINCT base type name its own counter,
 * incremented every time that name is needed again across the messages
 * in order (msg0, then msg1, then msg2) -- not a per-message-index
 * number. "TypeValue" appears once per message (0,1,2); "TypeMsgGrant"
 * appears twice (msg0, msg1 are both authz.MsgGrant) so it's 0,1;
 * "TypeMsgGrantAllowance" appears once (msg2 only) so it's just 0.
 */
const OPTIMIZE_GRANTS_TYPES: EIP712TypedData['types'] = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'string' },
    { name: 'salt', type: 'string' },
  ],
  Coin: [
    { name: 'denom', type: 'string' },
    { name: 'amount', type: 'string' },
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
  // msg0: staking GenericAuthorization grant
  TypeMsgGrant0: [
    { name: 'value', type: 'TypeValue0' },
    { name: 'type', type: 'string' },
  ],
  TypeValue0: [
    { name: 'granter', type: 'string' },
    { name: 'grantee', type: 'string' },
    { name: 'grant', type: 'TypeValueGrant0' },
  ],
  TypeValueGrant0: [
    { name: 'expiration', type: 'string' },
    { name: 'authorization', type: 'TypeValueGrantAuthorization0' },
  ],
  TypeValueGrantAuthorization0: [
    { name: 'value', type: 'TypeValueGrantAuthorizationValue0' },
    { name: 'type', type: 'string' },
  ],
  TypeValueGrantAuthorizationValue0: [{ name: 'msg', type: 'string' }],
  // msg1: bank SendAuthorization grant
  TypeMsgGrant1: [
    { name: 'value', type: 'TypeValue1' },
    { name: 'type', type: 'string' },
  ],
  TypeValue1: [
    { name: 'granter', type: 'string' },
    { name: 'grantee', type: 'string' },
    { name: 'grant', type: 'TypeValueGrant1' },
  ],
  TypeValueGrant1: [
    { name: 'expiration', type: 'string' },
    { name: 'authorization', type: 'TypeValueGrantAuthorization1' },
  ],
  TypeValueGrantAuthorization1: [
    { name: 'value', type: 'TypeValueGrantAuthorizationValue1' },
    { name: 'type', type: 'string' },
  ],
  // allow_list confirmed via a live typed-data dry-run against cosmos/evm's
  // own WrapTxToTypedData (2026-09-13, real KiiChain mainnet account) --
  // a populated allow_list is a bare `string[]` (arrays of primitives get
  // no named element type, unlike Coin[] above), and comes after
  // spend_limit, matching SendAuthorization's own proto field order.
  TypeValueGrantAuthorizationValue1: [
    { name: 'spend_limit', type: 'TypeValueGrantAuthorizationValueSpendLimit0[]' },
    { name: 'allow_list', type: 'string[]' },
  ],
  TypeValueGrantAuthorizationValueSpendLimit0: [
    { name: 'denom', type: 'string' },
    { name: 'amount', type: 'string' },
  ],
  // msg2: feegrant BasicAllowance
  TypeMsgGrantAllowance0: [
    { name: 'value', type: 'TypeValue2' },
    { name: 'type', type: 'string' },
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
  // Always empty in this bundle -- BasicAllowance is built with a nil
  // spend_limit (unlimited), matching production. An EMPTY repeated Coin
  // field renders as a bare `string[]` here, not `Coin[]` -- there is
  // nothing to support a non-empty limit in this fixed shape today.
  TypeValueAllowanceValue0: [{ name: 'spend_limit', type: 'string[]' }],
};

const REDELEGATE_MSG_TYPE_URL = '/cosmos.staking.v1beta1.MsgBeginRedelegate';

function formatExpiration(expirySeconds: number): string {
  // toISOString() always includes milliseconds ("...20.000Z"); the chain's
  // own protobuf Timestamp JSON marshaling omits the fractional part
  // entirely when it's exactly zero ("...20Z"). expirySeconds is always
  // whole seconds, so the .000 is always present and always stripped.
  return new Date(expirySeconds * 1000).toISOString().replace(/\.000Z$/, 'Z');
}

/**
 * Builds the EIP-712 typed-data payload for the "optimize grants" bundle.
 * Pure and synchronous -- caller supplies the current account number and
 * sequence (see fetchKiiAccount for a convenience LCD reader) rather than
 * this function reaching out to the network itself.
 */
export function buildOptimizeGrantsTypedData(
  params: OptimizeGrantsParams,
  signContext: SignContext,
  chain: ChainConfig
): EIP712TypedData {
  const expiration = formatExpiration(params.expirySeconds);

  return {
    types: OPTIMIZE_GRANTS_TYPES,
    primaryType: 'Tx',
    domain: {
      name: 'Cosmos Web3',
      version: '1.0.0',
      chainId: '0x' + chain.evmChainId.toString(16),
      verifyingContract: 'cosmos',
      salt: '0',
    },
    message: {
      account_number: signContext.accountNumber,
      chain_id: chain.cosmosChainId,
      sequence: signContext.sequence,
      memo: '',
      fee: {
        amount: [{ denom: 'akii', amount: signContext.feeAmountAkii }],
        gas: signContext.gasLimit,
      },
      msg0: {
        type: 'cosmos-sdk/MsgGrant',
        value: {
          granter: params.granterAddress,
          grantee: params.granteeAddress,
          grant: {
            authorization: {
              type: 'cosmos-sdk/GenericAuthorization',
              value: { msg: REDELEGATE_MSG_TYPE_URL },
            },
            expiration,
          },
        },
      },
      msg1: {
        type: 'cosmos-sdk/MsgGrant',
        value: {
          granter: params.granterAddress,
          grantee: params.granteeAddress,
          grant: {
            authorization: {
              type: 'cosmos-sdk/SendAuthorization',
              value: {
                spend_limit: [{ denom: 'akii', amount: params.transferSpendLimitAkii }],
                allow_list: [params.transferGrantAllowAddress],
              },
            },
            expiration,
          },
        },
      },
      msg2: {
        type: 'cosmos-sdk/MsgGrantAllowance',
        value: {
          granter: params.granterAddress,
          grantee: params.granteeAddress,
          allowance: {
            type: 'cosmos-sdk/BasicAllowance',
            value: { spend_limit: [] },
          },
        },
      },
    },
  };
}
