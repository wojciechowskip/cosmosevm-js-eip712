import { Any } from 'cosmjs-types/google/protobuf/any';
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { MsgGrant } from 'cosmjs-types/cosmos/authz/v1beta1/tx';
import { GenericAuthorization } from 'cosmjs-types/cosmos/authz/v1beta1/authz';
import { SendAuthorization } from 'cosmjs-types/cosmos/bank/v1beta1/authz';
import { BasicAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant';
import { MsgGrantAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/tx';
import { BinaryWriter, WireType } from 'cosmjs-types/binary';

import { GrantsParams, GrantSpec } from './types';

/**
 * KiiChain's account pubkey type (`/cosmos.evm.crypto.v1.ethsecp256k1.PubKey`,
 * confirmed against a real broadcast tx read back from KiiChain mainnet) is
 * NOT a standard cosmos-sdk type, so cosmjs-types has no generated codec for
 * it. Its proto shape is trivial -- `message PubKey { bytes key = 1; }` --
 * so it's hand-encoded here with the same BinaryWriter cosmjs-types' own
 * generated codecs use internally, rather than pulling in a whole extra
 * proto toolchain for one field.
 */
export const ETHSECP256K1_PUBKEY_TYPE_URL = '/cosmos.evm.crypto.v1.ethsecp256k1.PubKey';

export function encodeEthsecp256k1PubKey(compressedKey: Uint8Array): Any {
  const value = new BinaryWriter().uint32((1 << 3) | WireType.Bytes).bytes(compressedKey).finish();
  return Any.fromPartial({ typeUrl: ETHSECP256K1_PUBKEY_TYPE_URL, value });
}

function timestampFromUnixSeconds(seconds: number) {
  return { seconds: BigInt(seconds), nanos: 0 };
}

function buildAuthorizationAny(grant: Extract<GrantSpec, { kind: 'genericAuthorization' | 'sendAuthorization' }>): Any {
  if (grant.kind === 'genericAuthorization') {
    return Any.fromPartial({
      typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
      value: GenericAuthorization.encode({ msg: grant.msgTypeUrl }).finish(),
    });
  }

  const spendLimit: Coin[] = [{ denom: grant.spendLimit.denom, amount: grant.spendLimit.amount }];
  const allowList = grant.allowAddress ? [grant.allowAddress] : [];
  return Any.fromPartial({
    typeUrl: '/cosmos.bank.v1beta1.SendAuthorization',
    value: SendAuthorization.encode({ spendLimit, allowList }).finish(),
  });
}

/**
 * Builds the Any-wrapped messages for an arbitrary, caller-chosen
 * combination of grants (see GrantSpec in ./types), in the same order the
 * signed tx must carry them -- matches buildGrantsTypedData's msg0/msg1/...
 * exactly.
 */
export function buildGrantsAnyMessages(params: GrantsParams): Any[] {
  const expiration = timestampFromUnixSeconds(params.expirySeconds);

  return params.grants.map((grant) => {
    if (grant.kind === 'feeGrant') {
      // nil spend_limit = unlimited -- a deliberate choice matching Polli's
      // native (Keplr) flow, not a simplification.
      const feeAllowance = Any.fromPartial({
        typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
        value: BasicAllowance.encode({ spendLimit: [] }).finish(),
      });
      return Any.fromPartial({
        typeUrl: MsgGrantAllowance.typeUrl,
        value: MsgGrantAllowance.encode({
          granter: params.granterAddress,
          grantee: params.granteeAddress,
          allowance: feeAllowance,
        }).finish(),
      });
    }

    const authorization = buildAuthorizationAny(grant);
    return Any.fromPartial({
      typeUrl: MsgGrant.typeUrl,
      value: MsgGrant.encode({
        granter: params.granterAddress,
        grantee: params.granteeAddress,
        grant: { authorization, expiration },
      }).finish(),
    });
  });
}
