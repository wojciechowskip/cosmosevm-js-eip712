# cosmosevm-js-eip712

Small JS/TS library for signing a batch of Cosmos SDK authz/feegrant
**Grants** on KiiChain -- a caller-chosen combination of a generic authz
grant (e.g. staking redelegate, withdraw-rewards), a bank send authz grant,
and/or an unlimited feegrant, all to the same grantee, in one transaction --
with an EVM wallet (MetaMask) via `eth_signTypedData_v4`, instead of a
Cosmos wallet like Keplr.

## Why this is narrow, not a generic Cosmos-EVM EIP-712 engine

`cosmos/evm`'s own `ethereum/eip712` package (Go) is a generic amino-JSON →
EIP-712 encoder -- ~1500-2500 lines across encoding/preprocess/type-mapping
files, for arbitrary Cosmos messages. Porting that generically to JS was
judged too large and risky a task for what's actually needed here. Instead,
this library supports exactly **three grant kinds** -- `genericAuthorization`
(repeatable, parametrized by msg type URL), `sendAuthorization`, and
`feeGrant` -- combinable in any order via `GrantSpec[]`, which is what
Polli's own product actually needs (see `defaultGrantsList` in
`polli-frontend`'s `optimization-grants-message-builder.ts`: staking,
transfers, redelegate, fee, withdraw -- all either `genericAuthorization`,
`sendAuthorization`, or `feeGrant` underneath). It is deliberately not
generalized any further than that.

## Two real findings from building this that are worth knowing

1. **`ethers.TypedDataEncoder` cannot compute this hash at all.** It
   hardcodes the standard EIP-712 domain field types (`verifyingContract`
   as `address`) and throws `invalid address` on Cosmos-EVM's domain,
   which declares `verifyingContract` as a plain `string` (`"cosmos"`,
   not a 0x address). **`@metamask/eth-sig-util`** -- MetaMask's own
   implementation -- respects whatever domain schema you give it, verified
   with a real sign+recover round trip. Public-key recovery itself (once
   you have the correct digest) is still done with `ethers.SigningKey`,
   which is schema-agnostic pure ECDSA math and has no such limitation.
2. **Signature byte format for the on-chain broadcast matters and is easy
   to get backwards.** A reference Go implementation that broadcast
   successfully on mainnet explicitly bumps the recovery id from 0/1 to
   27/28 before embedding the signature in the transaction, and never
   converts it back. This library's `broadcastGrants` follows that proven
   behavior -- it keeps the signature exactly as `eth_signTypedData_v4`
   returns it (v as 27/28) all the way into the transaction. A naive port
   that "normalizes" the recovery id back to 0/1 before broadcasting
   (matching go-ethereum's own internal convention for its recovery
   functions) would be broadcasting something different from what
   actually verified on mainnet -- worth checking explicitly if you port
   this further, since it's a one-byte difference that's easy to miss and
   easy to get backwards.
3. **cosmos/evm's EIP-712 type generator deduplicates structurally
   identical nested types.** Two `genericAuthorization` grants for
   different msg type URLs (e.g. one for `MsgDelegate`, one for
   `MsgBeginRedelegate`) share the exact same field schema (`{msg:
   string}`), so cosmos/evm's generator reuses the same generated type
   name for both rather than minting a new one -- confirmed empirically
   with a `DRY_RUN` dump of a reference Go implementation's typed-data
   output against a real KiiChain mainnet account (2026-09-14). This
   library's `buildGrantsTypedData` implements that dedup rule -- shape is
   judged purely by field schema, never by the actual data inside it. See
   `test/fixtures/grantsFixture.ts`'s `DEDUP_FIXTURE_*` exports for the
   captured example this is verified against.

## Usage

```ts
import {
  KII_MAINNET,
  fetchAccount,
  buildGrantsTypedData,
  broadcastGrants,
  GrantSpec,
} from 'cosmosevm-js-eip712';

const grants: GrantSpec[] = [
  { kind: 'genericAuthorization', msgTypeUrl: '/cosmos.staking.v1beta1.MsgDelegate' },
  { kind: 'genericAuthorization', msgTypeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate' },
  {
    kind: 'sendAuthorization',
    spendLimit: { denom: 'akii', amount: '1000000000000000' },
    allowAddress: 'kii1...', // the ONLY address this transfer grant may send to
  },
  { kind: 'feeGrant' },
];

const params = {
  granterAddress: 'kii1...',
  granteeAddress: 'kii1...', // the address you're granting permissions to
  expirySeconds: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
  grants,
};

const { accountNumber, sequence } = await fetchAccount(KII_MAINNET.lcdUrl, params.granterAddress);
const signContext = { accountNumber, sequence, gasLimit: '400000', feeAmountAkii: '136000000000000' };

const typedData = buildGrantsTypedData(params, signContext, KII_MAINNET);

// Hand `typedData` to MetaMask, unmodified:
const signatureHex = await window.ethereum.request({
  method: 'eth_signTypedData_v4',
  params: [granterAddress, JSON.stringify(typedData)],
});

const result = await broadcastGrants(params, signContext, KII_MAINNET, signatureHex);
```

`broadcastGrants` never trusts a caller-supplied public key: it recovers
the actual signer from the signature itself (the same ECDSA recovery an
EVM node uses to find a raw transaction's sender) and throws unless it
matches `params.granterAddress`.

### `GrantSpec` kinds

- `{ kind: 'genericAuthorization', msgTypeUrl: string }` -- **repeatable.**
  Grants authorization to send any single Cosmos message of that type
  (e.g. `MsgBeginRedelegate`, `MsgDelegate`, `MsgWithdrawDelegatorReward`).
  Multiple instances (different `msgTypeUrl`s) dedupe onto one shared
  EIP-712 type behind the scenes -- there's no cost to adding more.
- `{ kind: 'sendAuthorization', spendLimit, allowAddress? }` -- a bank
  send authorization, capped at `spendLimit`. Omit `allowAddress` only if
  you specifically want an unrestricted-recipient grant (a materially
  broader permission than Polli's native flow ever issues).
- `{ kind: 'feeGrant' }` -- an unlimited `BasicAllowance` feegrant, no
  expiry.

**Not supported:** more than one `sendAuthorization` or `feeGrant` per
call. Polli's own native (Keplr) flow never batches more than one of
either, so this isn't a gap in practice -- just an explicit non-goal, to
avoid building out dedup/counter logic for a case that doesn't occur.

## What's NOT here

- **Delegate** (`MsgDelegate`) as a directly-signed message -- not needed
  through this path at all. KiiChain's EVM `Staking` precompile lets a
  plain `eth_sendTransaction` delegate directly; only granting authz needs
  EIP-712, since there is no authz/feegrant precompile. (`MsgDelegate` as
  the *target* of a `genericAuthorization` grant -- i.e. authorizing someone
  else to delegate on your behalf -- is fully supported, same as any other
  msg type URL.)
- **Real browser MetaMask end-to-end test.** The typedData construction is
  verified against a real captured mainnet example; the sign+recover round
  trip is verified with `@metamask/eth-sig-util`'s own reference signer
  (which real MetaMask is built on). Neither is the same as a real wallet
  popup in a real browser -- that's still open.
- **A dedicated Kii/Cosmos-EVM chain-agnostic config for other chains.**
  `KII_MAINNET` is the only provided `ChainConfig`.
- **Any authz/feegrant kind beyond the three `GrantSpec` variants above**
  (e.g. staking `Deny` authorizations, periodic feegrant allowances). Add
  one only when a real caller needs it, following the same
  capture-and-verify process this library was built with.

## Development

```
npm install
npm test
npm run build
```
