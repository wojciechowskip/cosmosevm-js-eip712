/**
 * Params for the "optimize grants" bundle -- staking redelegate authz,
 * bank send authz, and an unlimited feegrant, all to the same grantee.
 * Mirrors polli-eip712-service's OptimizeGrantsParams (Go), which this
 * library's fixed typedData shape was verified against on KiiChain
 * mainnet -- see test/fixtures/optimizeGrantsFixture.ts.
 */
export interface OptimizeGrantsParams {
  /** bech32 kii1... address of the account granting authority */
  granterAddress: string;
  /** bech32 kii1... address receiving the grants (Polli's optimizer signer) */
  granteeAddress: string;
  /** SendAuthorization spend limit, in akii (18-decimal, same as wei) */
  transferSpendLimitAkii: string;
  /** Unix seconds since epoch -- when the staking + transfer grants expire.
   * The feegrant allowance itself never expires, matching production. */
  expirySeconds: number;
}

/** Everything besides the message set that goes into the signed bytes.
 * Round-trips unmodified from build to broadcast, mirroring the Go
 * service's SignContext -- so any drift between what was built and what
 * gets broadcast surfaces as a signature-verification failure, not a
 * silently-different signed transaction. */
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
