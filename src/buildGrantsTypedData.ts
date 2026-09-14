import { GrantsParams, SignContext, ChainConfig, EIP712TypedData, GrantSpec } from './types';

/**
 * This is NOT a generic Cosmos-message-to-EIP712 encoder -- cosmos/evm's own
 * `eip712.WrapTxToTypedData` (Go, ~1500-2500 LOC across encoding/preprocess/
 * type-mapping files) is that, and porting it was judged not worth the risk
 * for the fixed, small set of grant kinds Polli actually needs. Instead,
 * this module hand-implements cosmos/evm's OBSERVED type-naming behavior
 * for exactly three message shapes (`genericAuthorization`, `sendAuthorization`,
 * `feeGrant`), reverse-engineered empirically against a reference Go
 * implementation's typed-data output (a `DRY_RUN` dump of
 * `eip712.WrapTxToTypedData`, smoke-tested live against KiiChain mainnet:
 * real account 50203, sequence 1). See test/fixtures/grantsFixture.ts for
 * the captured example this is verified against byte-for-byte. If a new
 * grant kind is ever added, or cosmos/evm's type-naming convention changes,
 * it needs re-verifying the same way -- it will not silently drift, since a
 * mismatch fails signature verification cleanly rather than misbehaving.
 *
 * The critical, empirically-confirmed rule this module implements: cosmos/evm's
 * generator performs STRUCTURAL DEDUPLICATION of nested type definitions.
 * Two messages that share the exact same field schema -- e.g. two
 * `genericAuthorization` grants for different msg type URLs -- collapse
 * onto the SAME numbered type name, rather than each getting its own
 * number. Verified 2026-09-14 by adding a second GenericAuthorization
 * message to the reference tool's dry-run: both collapsed onto
 * TypeMsgGrant0/TypeValue0/TypeValueGrant0/TypeValueGrantAuthorization0/
 * TypeValueGrantAuthorizationValue0, while the structurally-different
 * SendAuthorization message got its own TypeMsgGrant1/TypeValue1/etc., and
 * the feegrant (a different top-level envelope, MsgGrantAllowance) got its
 * own TypeMsgGrantAllowance0 while still continuing the SAME global
 * TypeValue counter at TypeValue2. Shape is judged purely by field schema
 * (names + types), never by the actual data inside it.
 *
 * Two counters drive the naming, both first-seen-order dedup counters:
 * - A GLOBAL counter drives `TypeValue<N>` -- it's the type name for ANY
 *   message's outer {type, value} wrapper's "value" field, reused across
 *   every envelope family (MsgGrant and MsgGrantAllowance alike).
 * - A PER-ENVELOPE-FAMILY counter (keyed by the top-level envelope --
 *   MsgGrant vs MsgGrantAllowance) drives `TypeMsgGrant<N>` /
 *   `TypeMsgGrantAllowance<N>` and that family's own nested type chain
 *   (`TypeValueGrant<N>`/`TypeValueGrantAuthorization<N>`/
 *   `TypeValueGrantAuthorizationValue<N>` for MsgGrant;
 *   `TypeValueAllowance<N>`/`TypeValueAllowanceValue<N>` for
 *   MsgGrantAllowance).
 *
 * One nested type, `TypeValueGrantAuthorizationValueSpendLimit<N>`
 * (SendAuthorization's own spend_limit Coin-array element type), is
 * hardcoded to suffix 0 rather than counted -- `sendAuthorization` is not
 * supported more than once per call (see GrantSpec in ./types), so this
 * counter never needs to advance in practice, and hardcoding it is
 * deliberately simpler than building a counter for a case that can't occur.
 */

const AKII_DENOM = 'akii';

type Shape = GrantSpec['kind'];
type Envelope = 'grant' | 'grantAllowance';

const ENVELOPE_BY_SHAPE: Record<Shape, Envelope> = {
  genericAuthorization: 'grant',
  sendAuthorization: 'grant',
  feeGrant: 'grantAllowance',
};

const ENVELOPE_TYPE_PREFIX: Record<Envelope, string> = {
  grant: 'TypeMsgGrant',
  grantAllowance: 'TypeMsgGrantAllowance',
};

const ENVELOPE_AMINO_TYPE: Record<Envelope, string> = {
  grant: 'cosmos-sdk/MsgGrant',
  grantAllowance: 'cosmos-sdk/MsgGrantAllowance',
};

/** Assigns sequential indices in first-seen order -- the shared mechanism
 * behind both the global TypeValue<N> counter and each envelope family's
 * own counter. */
class FirstSeenIndexer<K> {
  private readonly seen = new Map<K, number>();

  indexOf(key: K): number {
    let index = this.seen.get(key);
    if (index === undefined) {
      index = this.seen.size;
      this.seen.set(key, index);
    }
    return index;
  }
}

function formatExpiration(expirySeconds: number): string {
  // toISOString() always includes milliseconds ("...20.000Z"); the chain's
  // own protobuf Timestamp JSON marshaling omits the fractional part
  // entirely when it's exactly zero ("...20Z"). expirySeconds is always
  // whole seconds, so the .000 is always present and always stripped.
  return new Date(expirySeconds * 1000).toISOString().replace(/\.000Z$/, 'Z');
}

function registerShapeTypes(
  types: EIP712TypedData['types'],
  shape: Shape,
  envelope: Envelope,
  valueN: number,
  familyN: number
): void {
  types[`${ENVELOPE_TYPE_PREFIX[envelope]}${familyN}`] = [
    { name: 'value', type: `TypeValue${valueN}` },
    { name: 'type', type: 'string' },
  ];

  if (shape === 'feeGrant') {
    types[`TypeValue${valueN}`] = [
      { name: 'granter', type: 'string' },
      { name: 'grantee', type: 'string' },
      { name: 'allowance', type: `TypeValueAllowance${familyN}` },
    ];
    types[`TypeValueAllowance${familyN}`] = [
      { name: 'value', type: `TypeValueAllowanceValue${familyN}` },
      { name: 'type', type: 'string' },
    ];
    // Always empty in Polli's flow -- the feegrant allowance is built
    // unlimited (nil spend_limit), matching the native Keplr flow. An empty
    // repeated Coin field renders as a bare `string[]` here, not `Coin[]`.
    types[`TypeValueAllowanceValue${familyN}`] = [{ name: 'spend_limit', type: 'string[]' }];
    return;
  }

  types[`TypeValue${valueN}`] = [
    { name: 'granter', type: 'string' },
    { name: 'grantee', type: 'string' },
    { name: 'grant', type: `TypeValueGrant${familyN}` },
  ];
  types[`TypeValueGrant${familyN}`] = [
    { name: 'expiration', type: 'string' },
    { name: 'authorization', type: `TypeValueGrantAuthorization${familyN}` },
  ];
  types[`TypeValueGrantAuthorization${familyN}`] = [
    { name: 'value', type: `TypeValueGrantAuthorizationValue${familyN}` },
    { name: 'type', type: 'string' },
  ];

  if (shape === 'genericAuthorization') {
    types[`TypeValueGrantAuthorizationValue${familyN}`] = [{ name: 'msg', type: 'string' }];
    return;
  }

  // sendAuthorization. allow_list confirmed via a live typed-data dry-run
  // against cosmos/evm's own WrapTxToTypedData (2026-09-13, real KiiChain
  // mainnet account) -- a populated allow_list is a bare `string[]`
  // (arrays of primitives get no named element type, unlike Coin[] above),
  // and comes after spend_limit, matching SendAuthorization's own proto
  // field order.
  types[`TypeValueGrantAuthorizationValue${familyN}`] = [
    { name: 'spend_limit', type: 'TypeValueGrantAuthorizationValueSpendLimit0[]' },
    { name: 'allow_list', type: 'string[]' },
  ];
  types.TypeValueGrantAuthorizationValueSpendLimit0 = [
    { name: 'denom', type: 'string' },
    { name: 'amount', type: 'string' },
  ];
}

function buildGrantValue(
  grant: GrantSpec,
  params: GrantsParams,
  expiration: string
): Record<string, unknown> {
  if (grant.kind === 'feeGrant') {
    return {
      type: ENVELOPE_AMINO_TYPE.grantAllowance,
      value: {
        granter: params.granterAddress,
        grantee: params.granteeAddress,
        allowance: {
          type: 'cosmos-sdk/BasicAllowance',
          value: { spend_limit: [] },
        },
      },
    };
  }

  const authorization =
    grant.kind === 'genericAuthorization'
      ? { type: 'cosmos-sdk/GenericAuthorization', value: { msg: grant.msgTypeUrl } }
      : {
          type: 'cosmos-sdk/SendAuthorization',
          value: {
            spend_limit: [{ denom: grant.spendLimit.denom, amount: grant.spendLimit.amount }],
            allow_list: grant.allowAddress ? [grant.allowAddress] : [],
          },
        };

  return {
    type: ENVELOPE_AMINO_TYPE.grant,
    value: {
      granter: params.granterAddress,
      grantee: params.granteeAddress,
      grant: { authorization, expiration },
    },
  };
}

/**
 * Builds the EIP-712 typed-data payload for an arbitrary, caller-chosen
 * combination of grants (see GrantSpec in ./types). Pure and synchronous --
 * caller supplies the current account number and sequence (see fetchAccount
 * for a convenience LCD reader) rather than this function reaching out to
 * the network itself.
 */
export function buildGrantsTypedData(
  params: GrantsParams,
  signContext: SignContext,
  chain: ChainConfig
): EIP712TypedData {
  const expiration = formatExpiration(params.expirySeconds);

  const types: EIP712TypedData['types'] = {
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
    Tx: [],
  };

  const message: Record<string, unknown> = {
    account_number: signContext.accountNumber,
    chain_id: chain.cosmosChainId,
    fee: {
      amount: [{ denom: AKII_DENOM, amount: signContext.feeAmountAkii }],
      gas: signContext.gasLimit,
    },
    memo: '',
    sequence: signContext.sequence,
  };

  const txFields: Array<{ name: string; type: string }> = [
    { name: 'account_number', type: 'string' },
    { name: 'chain_id', type: 'string' },
    { name: 'fee', type: 'Fee' },
    { name: 'memo', type: 'string' },
    { name: 'sequence', type: 'string' },
  ];

  const globalValueIndex = new FirstSeenIndexer<Shape>();
  const familyIndex: Record<Envelope, FirstSeenIndexer<Shape>> = {
    grant: new FirstSeenIndexer<Shape>(),
    grantAllowance: new FirstSeenIndexer<Shape>(),
  };
  const registeredShapes = new Set<Shape>();

  params.grants.forEach((grant, msgIndex) => {
    const shape = grant.kind;
    const envelope = ENVELOPE_BY_SHAPE[shape];
    const valueN = globalValueIndex.indexOf(shape);
    const familyN = familyIndex[envelope].indexOf(shape);

    if (!registeredShapes.has(shape)) {
      registeredShapes.add(shape);
      registerShapeTypes(types, shape, envelope, valueN, familyN);
    }

    const msgKey = `msg${msgIndex}`;
    txFields.push({ name: msgKey, type: `${ENVELOPE_TYPE_PREFIX[envelope]}${familyN}` });
    message[msgKey] = buildGrantValue(grant, params, expiration);
  });

  types.Tx = txFields;

  return {
    types,
    primaryType: 'Tx',
    domain: {
      name: 'Cosmos Web3',
      version: '1.0.0',
      chainId: '0x' + chain.evmChainId.toString(16),
      verifyingContract: 'cosmos',
      salt: '0',
    },
    message,
  };
}
