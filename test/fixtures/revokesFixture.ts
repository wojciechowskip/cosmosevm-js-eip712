// Captured 2026-09-23 from a DRY RUN of cosmos/evm's own
// `eip712.WrapTxToTypedData` -- the exact generator KiiChain runs -- via
// `kii-poc-evm-authz/revokedump`. Nothing was signed and nothing was
// broadcast to produce this; account_number and sequence are dummies,
// since neither affects the type structure.
//
// This is GROUND TRUTH, not an expectation someone wrote by hand. If
// buildRevokesTypedData ever stops matching it byte for byte, the library
// is producing a hash the chain will not accept -- re-run the dump before
// changing this file.
export const REVOKES_FIXTURE_TYPED_DATA = {
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
        "type": "TypeMsgRevoke0"
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
        "type": "TypeMsgRevokeAllowance0"
      }
    ],
    "TypeMsgRevoke0": [
      {
        "name": "value",
        "type": "TypeValue0"
      },
      {
        "name": "type",
        "type": "string"
      }
    ],
    "TypeMsgRevokeAllowance0": [
      {
        "name": "value",
        "type": "TypeValue1"
      },
      {
        "name": "type",
        "type": "string"
      }
    ],
    "TypeValue0": [
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
    ],
    "TypeValue1": [
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
      "type": "cosmos-sdk/MsgRevoke",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh",
        "msg_type_url": "/cosmos.staking.v1beta1.MsgDelegate"
      }
    },
    "msg1": {
      "type": "cosmos-sdk/MsgRevoke",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh",
        "msg_type_url": "/cosmos.staking.v1beta1.MsgBeginRedelegate"
      }
    },
    "msg2": {
      "type": "cosmos-sdk/MsgRevoke",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh",
        "msg_type_url": "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
      }
    },
    "msg3": {
      "type": "cosmos-sdk/MsgRevoke",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh",
        "msg_type_url": "/cosmos.bank.v1beta1.MsgSend"
      }
    },
    "msg4": {
      "type": "cosmos-sdk/MsgRevokeAllowance",
      "value": {
        "grantee": "kii18nft3gjmryyach4vfhk2kgtm9gj2yk7px63euc",
        "granter": "kii1dsgu3p4m623ppaw03gddhul535yw3l2tdnuauh"
      }
    },
    "sequence": "1"
  }
} as const;
