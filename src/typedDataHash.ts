import { TypedDataUtils, SignTypedDataVersion } from '@metamask/eth-sig-util';

import { EIP712TypedData } from './types';

/**
 * Computes the EIP-712 digest for a typedData payload -- the SAME hash
 * `eth_signTypedData_v4` signs.
 *
 * Deliberately NOT ethers.TypedDataEncoder: verified empirically that it
 * hardcodes the standard EIP-712 domain field types (verifyingContract as
 * `address`) and cannot be told otherwise, so it throws
 * `invalid address (argument="address", value="cosmos", ...)` on
 * Cosmos-EVM's domain, which declares `verifyingContract` as `string` (see
 * the captured typedData in buildOptimizeGrantsTypedData.ts). eth-sig-util
 * is MetaMask's own implementation and respects whatever domain schema is
 * passed in `types.EIP712Domain` -- confirmed via a real sign+recover
 * round trip, matching what a real MetaMask popup does internally.
 */
export function hashTypedData(typedData: EIP712TypedData): Uint8Array {
  return TypedDataUtils.eip712Hash(
    typedData as unknown as Parameters<typeof TypedDataUtils.eip712Hash>[0],
    SignTypedDataVersion.V4
  );
}
