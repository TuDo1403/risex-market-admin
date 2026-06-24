import { assign, createMachine } from 'xstate'

import type { MarketAdminEnv } from '@/src/config/deployments'

type MarketDraftContext = {
  env?: MarketAdminEnv
  totalMarkets?: number
  shareId?: string
  lastError?: string
}

type MarketDraftEvent =
  | { type: 'SELECT_ENV'; env: MarketAdminEnv }
  | { type: 'DEPLOYMENTS_LOADED' }
  | { type: 'DEPLOYMENTS_FAILED'; error: string }
  | { type: 'LIVE_MARKETS_LOADED'; totalMarkets: number }
  | { type: 'LIVE_MARKETS_FAILED'; error: string }
  | { type: 'SUBMIT_DRAFT' }
  | { type: 'VALIDATION_PASSED' }
  | { type: 'VALIDATION_FAILED'; error: string }
  | { type: 'ATOMIC_TX_BUILT' }
  | { type: 'ATOMIC_TX_FAILED'; error: string }
  | { type: 'SHADOW_PASSED' }
  | { type: 'SHADOW_FAILED'; error: string }
  | { type: 'CREATE_REVIEW_LINK'; authenticated: boolean }
  | { type: 'REVIEW_LINK_CREATED'; shareId: string }
  | { type: 'REVIEW_LINK_FAILED'; error: string }
  | { type: 'SUBMIT_TRANSACTION' }
  | { type: 'TRANSACTION_SUBMITTED' }
  | { type: 'TRANSACTION_FAILED'; error: string }
  | { type: 'EDIT' }

export const marketDraftMachine = createMachine({
  types: {} as {
    context: MarketDraftContext
    events: MarketDraftEvent
  },
  id: 'marketDraft',
  initial: 'idle',
  context: {},
  states: {
    idle: {
      on: {
        SELECT_ENV: {
          target: 'loadingDeployments',
          actions: assign(({ event }) => ({
            env: event.env,
            lastError: undefined,
            shareId: undefined,
          })),
        },
      },
    },
    loadingDeployments: {
      on: {
        DEPLOYMENTS_LOADED: 'loadingLiveMarkets',
        DEPLOYMENTS_FAILED: {
          target: 'editing',
          actions: assign(({ event }) => ({ lastError: event.error })),
        },
      },
    },
    loadingLiveMarkets: {
      on: {
        LIVE_MARKETS_LOADED: {
          target: 'editing',
          actions: assign(({ event }) => ({
            totalMarkets: event.totalMarkets,
            lastError: undefined,
          })),
        },
        LIVE_MARKETS_FAILED: {
          target: 'editing',
          actions: assign(({ event }) => ({ lastError: event.error })),
        },
      },
    },
    editing: {
      on: {
        SELECT_ENV: {
          target: 'loadingDeployments',
          actions: assign(({ event }) => ({
            env: event.env,
            totalMarkets: undefined,
            shareId: undefined,
            lastError: undefined,
          })),
        },
        SUBMIT_DRAFT: {
          target: 'validating',
          guard: ({ context }) => context.env !== undefined && context.totalMarkets !== undefined,
          actions: assign({ lastError: undefined }),
        },
      },
    },
    validating: {
      on: {
        VALIDATION_PASSED: 'buildingAtomicTx',
        VALIDATION_FAILED: {
          target: 'editing',
          actions: assign(({ event }) => ({ lastError: event.error })),
        },
        EDIT: 'editing',
      },
    },
    buildingAtomicTx: {
      on: {
        ATOMIC_TX_BUILT: [
          {
            target: 'shadowExecuting',
            guard: ({ context }) => context.env === 'mainnet',
          },
          {
            target: 'readyForExecution',
          },
        ],
        ATOMIC_TX_FAILED: {
          target: 'editing',
          actions: assign(({ event }) => ({ lastError: event.error })),
        },
        EDIT: 'editing',
      },
    },
    shadowExecuting: {
      on: {
        SHADOW_PASSED: 'shadowPassed',
        SHADOW_FAILED: {
          target: 'shadowFailed',
          actions: assign(({ event }) => ({ lastError: event.error })),
        },
      },
    },
    shadowFailed: {
      on: {
        EDIT: 'editing',
        ATOMIC_TX_BUILT: 'shadowExecuting',
      },
    },
    shadowPassed: {
      on: {
        CREATE_REVIEW_LINK: [
          {
            target: 'creatingReviewLink',
            guard: ({ event }) => event.authenticated,
            actions: assign({ lastError: undefined }),
          },
          {
            actions: assign({ lastError: 'GitHub session is required before creating review links' }),
          },
        ],
        EDIT: 'editing',
      },
    },
    creatingReviewLink: {
      on: {
        REVIEW_LINK_CREATED: {
          target: 'readyForExecution',
          actions: assign(({ event }) => ({
            shareId: event.shareId,
            lastError: undefined,
          })),
        },
        REVIEW_LINK_FAILED: {
          target: 'shadowPassed',
          actions: assign(({ event }) => ({ lastError: event.error })),
        },
      },
    },
    readyForExecution: {
      on: {
        SUBMIT_TRANSACTION: 'submittingTransaction',
        EDIT: 'editing',
      },
    },
    submittingTransaction: {
      on: {
        TRANSACTION_SUBMITTED: 'submitted',
        TRANSACTION_FAILED: {
          target: 'readyForExecution',
          actions: assign(({ event }) => ({ lastError: event.error })),
        },
      },
    },
    submitted: {
      type: 'final',
    },
  },
})
