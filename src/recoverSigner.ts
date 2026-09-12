import { getBytes, computeAddress, SigningKey } from 'ethers';
import { toBech32 } from '@cosmjs/encoding';

const KII_BECH32_PREFIX = 'kii';

export interface RecoveredSigner {
  /** 33-byte compressed secp256k1 public key -- the exact shape KiiChain's
   * `ethsecp256k1.PubKey` proto message wraps (see encodeEthsecp256k1PubKey
   * in protobufMessages.ts). */
  compressedPubKey: Uint8Array;
  /** bech32 kii1... address derived from the SAME 20 bytes as the 0x
   * address -- ethsecp256k1 chains define the account address as the raw
   * Ethereum address bytes, just re-encoded (verified 2026-09-10 against
   * a real KiiChain mainnet account: 0x.../kii1... share the identical
   * 20 bytes). */
  address: string;
}

/**
 * Recovers the actual signer from a 65-byte MetaMask-shaped signature
 * (r||s||v, v as 27/28) over a given digest -- the SAME ECDSA public-key
 * recovery an EVM node uses to find a raw transaction's sender. NEVER
 * trust a caller-supplied public key or address for this: only what
 * recovers from the signature itself proves who actually signed.
 */
export function recoverSigner(digest: Uint8Array, signatureHex: string): RecoveredSigner {
  const uncompressedPubKey = SigningKey.recoverPublicKey(digest, signatureHex);
  const compressedHex = SigningKey.computePublicKey(uncompressedPubKey, true);
  const compressedPubKey = getBytes(compressedHex);

  const ethAddress = computeAddress(uncompressedPubKey);
  const address = toBech32(KII_BECH32_PREFIX, getBytes(ethAddress));

  return { compressedPubKey, address };
}

/**
 * Recovers the signer and throws unless it matches `expectedGranterAddress`
 * -- a signature only recovers to the address that actually produced it,
 * so this is a real integrity check, not a formality. Mirrors
 * polli-eip712-service's BroadcastOptimizeGrants (Go) exactly.
 */
export function verifySignerMatchesGranter(
  digest: Uint8Array,
  signatureHex: string,
  expectedGranterAddress: string
): RecoveredSigner {
  const recovered = recoverSigner(digest, signatureHex);
  if (recovered.address !== expectedGranterAddress) {
    throw new Error(
      `signature does not match claimed granter: signed by ${recovered.address}, claimed ${expectedGranterAddress}`
    );
  }
  return recovered;
}
