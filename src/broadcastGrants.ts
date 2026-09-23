import { getBytes } from 'ethers';
import { TxBody, AuthInfo, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';

import { Any } from 'cosmjs-types/google/protobuf/any';

import { GrantsParams, RevokesParams, SignContext, ChainConfig, EIP712TypedData } from './types';
import { buildGrantsTypedData, buildRevokesTypedData } from './buildGrantsTypedData';
import { hashTypedData } from './typedDataHash';
import { verifySignerMatchesGranter } from './recoverSigner';
import {
  buildGrantsAnyMessages,
  buildRevokesAnyMessages,
  encodeEthsecp256k1PubKey,
} from './protobufMessages';

export interface BroadcastResult {
  httpStatus: number;
  txHash?: string;
  code?: number;
  rawLog: string;
}

/**
 * Rebuilds the exact same messages and sign bytes buildGrantsTypedData
 * produced (never trusts a caller-supplied hash or public key), recovers the
 * actual signer from the signature, refuses to proceed unless it matches
 * `params.granterAddress`, assembles the signed transaction, and broadcasts
 * it to the LCD.
 *
 * IMPORTANT -- signature byte format: the signature is kept EXACTLY as
 * eth_signTypedData_v4 / a real MetaMask returns it (65 bytes, recovery id
 * as 27/28, "yellow paper" convention) all the way into the broadcast
 * transaction. This matches what a reference Go implementation (the proven,
 * mainnet-verified source this schema was captured from) actually broadcast
 * successfully -- it explicitly bumps a raw 0/1 signature to 27/28 before
 * embedding it ("v: 0/1 -> 27/28, per KiiChain's own helper") and never
 * converts it back. A port that "normalizes" the recovery id to 0/1 before
 * broadcasting (matching go-ethereum's own internal convention for its
 * recovery functions, rather than the wire convention the chain expects in
 * the actual transaction bytes) would be broadcasting something different
 * from what actually verified on mainnet -- treat that as a real bug, not a
 * style choice, if you ever see it.
 */
export async function broadcastGrants(
  params: GrantsParams,
  signContext: SignContext,
  chain: ChainConfig,
  signatureHex: string
): Promise<BroadcastResult> {
  return broadcastSigned(
    buildGrantsTypedData(params, signContext, chain),
    buildGrantsAnyMessages(params),
    params.granterAddress,
    signContext,
    chain,
    signatureHex
  );
}

/**
 * The revoke counterpart of broadcastGrants, with the identical contract:
 * it rebuilds the typed data and the protobuf messages itself from
 * `params`, never trusting a caller-supplied hash or public key, and
 * refuses to broadcast unless the signature recovers to
 * `params.granterAddress`.
 *
 * Worth saying once, because it is the failure this is most likely to
 * produce in practice: the messages are atomic, and the authz module errors
 * on revoking an authorization that is not there. One stale entry in
 * `params.revokes` fails the whole transaction and nothing is withdrawn.
 * Read the granter's live grants immediately before building the params.
 */
export async function broadcastRevokes(
  params: RevokesParams,
  signContext: SignContext,
  chain: ChainConfig,
  signatureHex: string
): Promise<BroadcastResult> {
  return broadcastSigned(
    buildRevokesTypedData(params, signContext, chain),
    buildRevokesAnyMessages(params),
    params.granterAddress,
    signContext,
    chain,
    signatureHex
  );
}

async function broadcastSigned(
  typedData: EIP712TypedData,
  messages: Any[],
  granterAddress: string,
  signContext: SignContext,
  chain: ChainConfig,
  signatureHex: string
): Promise<BroadcastResult> {
  const digest = hashTypedData(typedData);

  const { compressedPubKey } = verifySignerMatchesGranter(digest, signatureHex, granterAddress);

  const bodyBytes = TxBody.encode(TxBody.fromPartial({ messages, memo: '' })).finish();

  const authInfoBytes = AuthInfo.encode(
    AuthInfo.fromPartial({
      signerInfos: [
        {
          publicKey: encodeEthsecp256k1PubKey(compressedPubKey),
          modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
          sequence: BigInt(signContext.sequence),
        },
      ],
      fee: {
        amount: [{ denom: 'akii', amount: signContext.feeAmountAkii }],
        gasLimit: BigInt(signContext.gasLimit),
        payer: '',
        granter: '',
      },
    })
  ).finish();

  const signatureBytes = getBytes(signatureHex);
  const txBytes = TxRaw.encode(
    TxRaw.fromPartial({ bodyBytes, authInfoBytes, signatures: [signatureBytes] })
  ).finish();

  const res = await fetch(`${chain.lcdUrl}/cosmos/tx/v1beta1/txs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tx_bytes: Buffer.from(txBytes).toString('base64'),
      mode: 'BROADCAST_MODE_SYNC',
    }),
  });
  const body = (await res.json()) as {
    tx_response?: { txhash?: string; code?: number };
  };

  return {
    httpStatus: res.status,
    txHash: body.tx_response?.txhash,
    code: body.tx_response?.code,
    rawLog: JSON.stringify(body),
  };
}
