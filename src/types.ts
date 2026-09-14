/**
 * One grant to include in the batch, in the order it should appear in the
 * signed transaction. `genericAuthorization` may repeat (e.g. one for
 * MsgDelegate, one for MsgBeginRedelegate) -- cosmos/evm's EIP-712 encoder
 * gives every GenericAuthorization the identical {msg: string} shape
 * regardless of which msg type URL it carries, so repeats share one type
 * definition rather than minting a new one each time (confirmed via a live
 * typed-data dry-run against cosmos/evm's own WrapTxToTypedData, 2026-09-14).
 *
 * `sendAuthorization` and `feeGrant` are NOT verified for more than one
 * occurrence each -- that's also all Polli's own native (Keplr) flow ever
 * batches, so a second occurrence of either is unsupported territory, not a
 * silent limitation.
 */
export type GrantSpec =
  | { kind: 'genericAuthorization'; msgTypeUrl: string }
  | {
      kind: 'sendAuthorization';
      spendLimit: { denom: string; amount: string };
      /** Restricts the grant to sending ONLY to this address (SendAuthorization's
       * allow_list, one entry) -- omit only if you specifically want an
       * unrestricted-recipient grant, which is a materially broader permission. */
      allowAddress?: string;
    }
  | { kind: 'feeGrant' };

export interface GrantsParams {
  /** bech32 kii1... address of the account granting authority */
  granterAddress: string;
  /** bech32 kii1... address receiving the grants */
  granteeAddress: string;
  /** Unix seconds since epoch -- when authz grants expire. Applies to every
   * `genericAuthorization`/`sendAuthorization` entry; the feegrant allowance
   * itself never expires, matching Polli's own native flow. */
  expirySeconds: number;
  grants: GrantSpec[];
}

/** Everything besides the message set that goes into the signed bytes.
 * Round-trips unmodified from build to broadcast -- so any drift between
 * what was built and what gets broadcast surfaces as a
 * signature-verification failure, not a silently-different signed
 * transaction. */
export interface SignContext {
  accountNumber: string;
  sequence: string;
  gasLimit: string;
  feeAmountAkii: string;
}

export interface ChainConfig {
  /** e.g. "kiichain_1783-1" */
  cosmosChainId: string;
  /** e.g. 1783 */
  evmChainId: number;
  /** e.g. "https://lcd.kiivalidator.com" */
  lcdUrl: string;
}

export const KII_MAINNET: ChainConfig = {
  cosmosChainId: 'kiichain_1783-1',
  evmChainId: 1783,
  lcdUrl: 'https://lcd.kiivalidator.com',
};

/** The exact JSON shape eth_signTypedData_v4 expects -- pass this object
 * (via JSON.stringify) to window.ethereum.request VERBATIM. Do not
 * reformat or re-key it along the way; the signed hash is computed from
 * these exact bytes. */
export interface EIP712TypedData {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: {
    name: string;
    version: string;
    chainId: string;
    verifyingContract: string;
    salt: string;
  };
  message: Record<string, unknown>;
}
