export const perpsMarketConfigAbi = [
  {
    type: 'function',
    name: 'getTotalMarkets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'getMarketConfig',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint16' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'quote', type: 'address' },
          { name: 'unlocked', type: 'bool' },
          { name: 'maxLeverage', type: 'uint8' },
          { name: 'maintenanceMarginFactor', type: 'uint80' },
          { name: 'minOrderStep', type: 'uint32' },
          { name: 'maxOrderStep', type: 'uint32' },
          { name: 'oiLimitSteps', type: 'uint32' },
          { name: 'stepSize', type: 'uint64' },
          { name: 'stepPrice', type: 'uint64' },
          { name: 'matchPriceBandBps', type: 'uint24' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getImpactNotionalBaseUsdc',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint16' }],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'openMarket',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          {
            name: 'perpsConfig',
            type: 'tuple',
            components: [
              { name: 'name', type: 'string' },
              { name: 'quote', type: 'address' },
              { name: 'unlocked', type: 'bool' },
              { name: 'maxLeverage', type: 'uint8' },
              { name: 'maintenanceMarginFactor', type: 'uint80' },
              { name: 'minOrderStep', type: 'uint32' },
              { name: 'maxOrderStep', type: 'uint32' },
              { name: 'oiLimitSteps', type: 'uint32' },
              { name: 'stepSize', type: 'uint64' },
              { name: 'stepPrice', type: 'uint64' },
              { name: 'matchPriceBandBps', type: 'uint24' },
            ],
          },
          {
            name: 'bookConfig',
            type: 'tuple',
            components: [
              { name: 'base', type: 'address' },
              { name: 'quote', type: 'address' },
              { name: 'pricePrecision', type: 'uint8' },
              { name: 'sizePrecision', type: 'uint8' },
              { name: 'tickSize', type: 'uint64' },
              { name: 'minSize', type: 'uint64' },
              { name: 'maxSize', type: 'uint64' },
            ],
          },
          { name: 'markPriceId', type: 'bytes32' },
          { name: 'indexPriceId', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setMarketLock',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint16' },
      { name: 'locked', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateMarketConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint16' },
      {
        name: 'config',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'quote', type: 'address' },
          { name: 'unlocked', type: 'bool' },
          { name: 'maxLeverage', type: 'uint8' },
          { name: 'maintenanceMarginFactor', type: 'uint80' },
          { name: 'minOrderStep', type: 'uint32' },
          { name: 'maxOrderStep', type: 'uint32' },
          { name: 'oiLimitSteps', type: 'uint32' },
          { name: 'stepSize', type: 'uint64' },
          { name: 'stepPrice', type: 'uint64' },
          { name: 'matchPriceBandBps', type: 'uint24' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setDeferredMode',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint16' },
      { name: 'enabled', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setImpactNotionalBaseUsdc',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint16' },
      { name: 'impactNotionalBaseUsdc', type: 'uint64' },
    ],
    outputs: [],
  },
] as const

export const accessManagerAbi = [
  {
    type: 'function',
    name: 'canCall',
    stateMutability: 'view',
    inputs: [
      { name: 'caller', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const ordersManagerAbi = [
  {
    type: 'function',
    name: 'isDeferredMode',
    stateMutability: 'view',
    inputs: [
      { name: 'protocol', type: 'address' },
      { name: 'marketId', type: 'uint16' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const multiSendAbi = [
  {
    type: 'function',
    name: 'multiSend',
    stateMutability: 'payable',
    inputs: [{ name: 'transactions', type: 'bytes' }],
    outputs: [],
  },
] as const
