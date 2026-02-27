export enum ApprovalType {
  OtherChainApproval = 'approveOtherChain',
  GasLimitApproval = 'approveGasLimit'
}

const NETWORK_PRESETS = {
  ethereum: {
    default: {
      local: 'direct'
    },
    1: {
      public: 'https://ethereum-rpc.publicnode.com'
    },
    10: {
      public: 'https://optimism-rpc.publicnode.com'
    },
    137: {
      public: 'https://polygon-bor-rpc.publicnode.com'
    },
    8453: {
      public: 'https://base-rpc.publicnode.com'
    },
    42161: {
      public: 'https://arbitrum-one-rpc.publicnode.com'
    },
    84532: {
      public: 'https://base-sepolia-rpc.publicnode.com'
    },
    11155111: {
      public: 'https://ethereum-sepolia-rpc.publicnode.com'
    },
    11155420: {
      public: 'https://optimism-sepolia-rpc.publicnode.com'
    }
  }
}

const ADDRESS_DISPLAY_CHARS = 8
const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000'
const MAX_HEX = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

export { NETWORK_PRESETS, ADDRESS_DISPLAY_CHARS, NATIVE_CURRENCY, MAX_HEX }
