import { Wallet } from 'ethers';
import { signTypedData, SignTypedDataVersion } from '@metamask/eth-sig-util';
import { toBech32 } from '@cosmjs/encoding';
import { describe, it, expect } from 'vitest';

import { hashTypedData } from '../src/typedDataHash';
import { recoverSigner, verifySignerMatchesGranter } from '../src/recoverSigner';
import { buildGrantsTypedData } from '../src/buildGrantsTypedData';
import { FIXTURE_PARAMS, FIXTURE_SIGN_CONTEXT, FIXTURE_CHAIN } from './fixtures/grantsFixture';

describe('recoverSigner', () => {
  it('recovers the real signer from a signature produced the same way MetaMask would (eth_signTypedData_v4)', () => {
    const wallet = Wallet.createRandom();
    const typedData = buildGrantsTypedData(FIXTURE_PARAMS, FIXTURE_SIGN_CONTEXT, FIXTURE_CHAIN);
    const digest = hashTypedData(typedData);

    // signTypedData is eth-sig-util's own reference implementation of what
    // eth_signTypedData_v4 does inside a real wallet -- signing over the
    // same digest hashTypedData computes, not a shortcut around it.
    const signatureHex = signTypedData({
      privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'),
      data: typedData as any,
      version: SignTypedDataVersion.V4,
    });

    const expectedAddress = toBech32(
      'kii',
      Buffer.from(wallet.address.slice(2), 'hex')
    );

    const recovered = recoverSigner(digest, signatureHex);
    expect(recovered.address).toBe(expectedAddress);
    expect(recovered.compressedPubKey.length).toBe(33);
  });

  it('throws when the recovered signer does not match the claimed granter', () => {
    const wallet = Wallet.createRandom();
    const typedData = buildGrantsTypedData(FIXTURE_PARAMS, FIXTURE_SIGN_CONTEXT, FIXTURE_CHAIN);
    const digest = hashTypedData(typedData);

    const signatureHex = signTypedData({
      privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'),
      data: typedData as any,
      version: SignTypedDataVersion.V4,
    });

    // FIXTURE_PARAMS.granterAddress belongs to a DIFFERENT, known key --
    // the signer above is a fresh random wallet, so this must be refused.
    expect(() =>
      verifySignerMatchesGranter(digest, signatureHex, FIXTURE_PARAMS.granterAddress)
    ).toThrow(/does not match claimed granter/);
  });
});
