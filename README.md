# cosmos-js-eip712-kii

Small JS/TS library for signing an "optimize grants" bundle on KiiChain --
a staking redelegate authz grant, a bank send authz grant, and an unlimited
feegrant, all to the same grantee, in one transaction -- with an EVM wallet
(MetaMask) via `eth_signTypedData_v4`, instead of a Cosmos wallet like
Keplr.

## Why this is narrow, not a generic Cosmos-EVM EIP-712 engine

`cosmos/evm`'s own `ethereum/eip712` package (Go) is a generic amino-JSON →
EIP-712 encoder -- ~1500-2500 lines across encoding/preprocess/type-mapping
files, for arbitrary Cosmos messages. Porting that generically to JS was
judged too large and risky a task for what's actually needed here: **one
fixed, three-message bundle**, always in the same shape.

So instead of porting the generic engine, this library's `types` schema is
captured **verbatim** from a reference Go implementation (built on
`cosmos/evm`'s own `eip712.WrapTxToTypedData`) that was smoke-tested live
against KiiChain mainnet, and pinned down with a byte-for-byte test
(`test/buildOptimizeGrantsTypedData.test.ts` against
`test/fixtures/optimizeGrantsFixture.ts`, a real captured example: account
50203, sequence advanced to 1 after a prior real broadcast). If a future
message combination is needed, it needs its own captured-and-verified
schema -- this is not a general-purpose tool for arbitrary Cosmos messages.

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
   converts it back. This library's `broadcastOptimizeGrants` follows that
   proven behavior -- it keeps the signature exactly as
   `eth_signTypedData_v4` returns it (v as 27/28) all the way into the
   transaction. A naive port that "normalizes" the recovery id back to 0/1
   before broadcasting (matching go-ethereum's own internal convention for
   its recovery functions) would be broadcasting something different from
   what actually verified on mainnet -- worth checking explicitly if you
   port this further, since it's a one-byte difference that's easy to miss
   and easy to get backwards.

## Usage

```ts
import {
  KII_MAINNET,
  fetchAccount,
  buildOptimizeGrantsTypedData,
  broadcastOptimizeGrants,
} from 'cosmos-js-eip712-kii';

const params = {
  granterAddress: 'kii1...',
  granteeAddress: 'kii1...', // the address you're granting permissions to
  transferSpendLimitAkii: '1000000000000000',
  expirySeconds: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
};

const { accountNumber, sequence } = await fetchAccount(KII_MAINNET.lcdUrl, params.granterAddress);
const signContext = { accountNumber, sequence, gasLimit: '400000', feeAmountAkii: '136000000000000' };

const { typedData } = { typedData: buildOptimizeGrantsTypedData(params, signContext, KII_MAINNET) };

// Hand `typedData` to MetaMask, unmodified:
const signatureHex = await window.ethereum.request({
  method: 'eth_signTypedData_v4',
  params: [granterAddress, JSON.stringify(typedData)],
});

const result = await broadcastOptimizeGrants(params, signContext, KII_MAINNET, signatureHex);
```

`broadcastOptimizeGrants` never trusts a caller-supplied public key: it
recovers the actual signer from the signature itself (the same ECDSA
recovery an EVM node uses to find a raw transaction's sender) and throws
unless it matches `params.granterAddress`.

## What's NOT here

- **Delegate** (`MsgDelegate`) -- not needed through this path at all.
  KiiChain's EVM `Staking` precompile lets a plain `eth_sendTransaction`
  delegate directly; only granting authz needs EIP-712, since there is no
  authz/feegrant precompile.
- **Real browser MetaMask end-to-end test.** The typedData construction is
  verified against a real captured mainnet example; the sign+recover round
  trip is verified with `@metamask/eth-sig-util`'s own reference signer
  (which real MetaMask is built on). Neither is the same as a real wallet
  popup in a real browser -- that's still open.
- **A dedicated Kii/Cosmos-EVM chain-agnostic config for other chains.**
  `KII_MAINNET` is the only provided `ChainConfig`; the `types` schema
  itself is fixed to this one message combination, not parameterized per
  chain.

## Development

```
npm install
npm test
npm run build
```
