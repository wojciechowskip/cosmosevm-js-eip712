import { Any } from 'cosmjs-types/google/protobuf/any';
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { MsgGrant } from 'cosmjs-types/cosmos/authz/v1beta1/tx';
import { GenericAuthorization } from 'cosmjs-types/cosmos/authz/v1beta1/authz';
import { SendAuthorization } from 'cosmjs-types/cosmos/bank/v1beta1/authz';
import { BasicAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant';
import { MsgGrantAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/tx';
import { BinaryWriter, WireType } from 'cosmjs-types/binary';

import { OptimizeGrantsParams } from './types';

/** cosmos.staking.v1beta1.MsgBeginRedelegate -- the ONLY message type the
 * staking grant authorizes, matching production and polli-eip712-service
 * (Go) exactly. */
export const REDELEGATE_MSG_TYPE_URL = '/cosmos.staking.v1beta1.MsgBeginRedelegate';

const AKII_DENOM = 'akii';

function timestampFromUnixSeconds(seconds: number) {
  return { seconds: BigInt(seconds), nanos: 0 };
}

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

/**
 * Builds the three Any-wrapped messages for the "optimize grants" bundle,
 * in the FIXED order the signed tx must carry them (matches
 * buildOptimizeGrantsTypedData's msg0/msg1/msg2 and
 * polli-eip712-service's BuildOptimizeGrantsMessages exactly).
 */
export function buildOptimizeGrantsAnyMessages(params: OptimizeGrantsParams): Any[] {
  const expiration = timestampFromUnixSeconds(params.expirySeconds);

  const stakingAuthorization = Any.fromPartial({
    typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
    value: GenericAuthorization.encode({ msg: REDELEGATE_MSG_TYPE_URL }).finish(),
  });
  const msg0 = Any.fromPartial({
    typeUrl: MsgGrant.typeUrl,
    value: MsgGrant.encode({
      granter: params.granterAddress,
      grantee: params.granteeAddress,
      grant: { authorization: stakingAuthorization, expiration },
    }).finish(),
  });

  const spendLimit: Coin[] = [{ denom: AKII_DENOM, amount: params.transferSpendLimitAkii }];
  const transferAuthorization = Any.fromPartial({
    typeUrl: '/cosmos.bank.v1beta1.SendAuthorization',
    value: SendAuthorization.encode({ spendLimit, allowList: [] }).finish(),
  });
  const msg1 = Any.fromPartial({
    typeUrl: MsgGrant.typeUrl,
    value: MsgGrant.encode({
      granter: params.granterAddress,
      grantee: params.granteeAddress,
      grant: { authorization: transferAuthorization, expiration },
    }).finish(),
  });

  // nil spend_limit + nil expiration = unlimited, no expiry -- matches
  // production and polli-eip712-service exactly, not a simplification.
  const feeAllowance = Any.fromPartial({
    typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
    value: BasicAllowance.encode({ spendLimit: [] }).finish(),
  });
  const msg2 = Any.fromPartial({
    typeUrl: MsgGrantAllowance.typeUrl,
    value: MsgGrantAllowance.encode({
      granter: params.granterAddress,
      grantee: params.granteeAddress,
      allowance: feeAllowance,
    }).finish(),
  });

  return [msg0, msg1, msg2];
}
