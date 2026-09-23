// Captured 2026-09-23 from `FEE_FIRST=1 go run ./revokedump` in
// kii-poc-evm-authz -- a dry run of cosmos/evm's own
// `eip712.WrapTxToTypedData`. Nothing signed, nothing broadcast.
//
// This is the ordering apps/web ACTUALLY produces: use-revoke-grants.ts
// pushes `fee` first, then transfers/staking/redelegate/withdraw, so the
// flat MsgRevokeAllowance shape is seen BEFORE the MsgRevoke one and the
// global TypeValue counter numbers them the other way round
// (TypeValue0 = {granter, grantee}, TypeValue1 = {msg_type_url, granter,
// grantee}) -- the inverse of REVOKES_FIXTURE_TYPED_DATA.
//
// It exists because the review of polli-frontend !171 pointed out that
// every captured fixture put the allowance LAST, i.e. the one ordering
// production never uses. The global-counter model predicted this output
// and the dump confirms it -- but "predicted" is not this library's
// standard, so it is now captured.
export const REVOKES_FEE_FIRST_FIXTURE_TYPED_DATA = {
  "types": {
    "Coin": [
      {
        "name": "denom",
        "type": "string"
      },
      {
        "name": "amount",
        "type": "string"
      }
    ],
    "EIP712Domain": [
      {
        "name": "name",
        "type": "string"
      },
      {
        "name": "version",
        "type": "string"
      },
      {
        "name": "chainId",
        "type": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "string"
      },
      {
        "name": "salt",
        "type": "string"
      }
    ],
    "Fee": [
      {
        "name": "amount",
        "type": "Coin[]"
      },
      {
        "name": "gas",
        "type": "string"
      }
    ],
    "Tx": [
      {
        "name": "account_number",
        "type": "string"
      },
      {
        "name": "chain_id",
        "type": "string"
      },
      {
        "name": "fee",
        "type": "Fee"
      },
      {
        "name": "memo",
        "type": "string"
      },
      {
        "name": "sequence",
        "type": "string"
      },
      {
        "name": "msg0",
        "type": "TypeMsgRevokeAllowance0"
      },
      {
        "name": "msg1",
        "type": "TypeMsgRevoke0"
      },
      {
        "name": "msg2",
        "type": "TypeMsgRevoke0"
      },
      {
        "name": "msg3",
        "type": "TypeMsgRevoke0"
      },
      {
        "name": "msg4",
        "type": "TypeMsgRevoke0"
      }
    ],
    "TypeMsgRevoke0": [
      {
        "name": "value",
        "type": "TypeValue1"
      },
      {
        "name": "type",
        "type": "string"
      }
    ],
    "TypeMsgRevokeAllowance0": [
      {
        "name": "value",
        "type": "TypeValue0"
      },
      {
        "name": "type",
        "type": "string"
      }
    ],
    "TypeValue0": [
      {
        "name": "granter",
        "type": "string"
      },
      {
        "name": "grantee",
        "type": "string"
      }
    ],
    "TypeValue1": [
      {
        "name": "msg_type_url",
        "type": "string"
      },
      {
        "name": "granter",
        "type": "string"
      },
      {
        "name": "grantee",
        "type": "string"
      }
    ]
  },
  "primaryType": "Tx",
  "domain": {
    "name": "Cosmos Web3",
    "version": "1.0.0",
    "chainId": "0x6f7",
    "verifyingContract": "cosmos",
    "salt": "0"
  },
  "message": {
    "account_number": "1",
    "chain_id": "kiichain_1783-1",
    "fee": {
      "amount": [
        {
          "amount": "2000000000000000",
          "denom": "akii"
        }
      ],
      "gas": "400000"
    },
    "memo": "",
    "msg0": {
      "type": "cosmos-sdk/MsgRevokeAllowance",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh"
      }
    },
    "msg1": {
      "type": "cosmos-sdk/MsgRevoke",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh",
        "msg_type_url": "/cosmos.staking.v1beta1.MsgDelegate"
      }
    },
    "msg2": {
      "type": "cosmos-sdk/MsgRevoke",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh",
        "msg_type_url": "/cosmos.staking.v1beta1.MsgBeginRedelegate"
      }
    },
    "msg3": {
      "type": "cosmos-sdk/MsgRevoke",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh",
        "msg_type_url": "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
      }
    },
    "msg4": {
      "type": "cosmos-sdk/MsgRevoke",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh",
        "msg_type_url": "/cosmos.bank.v1beta1.MsgSend"
      }
    },
    "sequence": "1"
  }
} as const;
