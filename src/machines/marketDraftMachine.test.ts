import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { marketDraftMachine } from './marketDraftMachine'

function startMachine() {
  const actor = createActor(marketDraftMachine)
  actor.start()
  return actor
}

describe('marketDraftMachine', () => {
  it('moves through the happy path to readyForSafe only after shadow pass and review link creation', () => {
    const actor = startMachine()

    expect(actor.getSnapshot().value).toBe('idle')

    actor.send({ type: 'SELECT_ENV', env: 'mainnet' })
    expect(actor.getSnapshot().value).toBe('loadingDeployments')

    actor.send({ type: 'DEPLOYMENTS_LOADED' })
    expect(actor.getSnapshot().value).toBe('loadingLiveMarkets')

    actor.send({ type: 'LIVE_MARKETS_LOADED', totalMarkets: 15 })
    expect(actor.getSnapshot().value).toBe('editing')

    actor.send({ type: 'SUBMIT_DRAFT' })
    expect(actor.getSnapshot().value).toBe('validating')

    actor.send({ type: 'VALIDATION_PASSED' })
    expect(actor.getSnapshot().value).toBe('buildingMultisend')

    actor.send({ type: 'MULTISEND_BUILT' })
    expect(actor.getSnapshot().value).toBe('shadowExecuting')

    actor.send({ type: 'SHADOW_PASSED' })
    expect(actor.getSnapshot().value).toBe('shadowPassed')

    actor.send({ type: 'CREATE_REVIEW_LINK', authenticated: true })
    expect(actor.getSnapshot().value).toBe('creatingReviewLink')

    actor.send({ type: 'REVIEW_LINK_CREATED', shareId: 'share_123' })
    expect(actor.getSnapshot().value).toBe('readyForSafe')
  })

  it('skips shadow execution for testnet EOA proposals', () => {
    const actor = startMachine()
    actor.send({ type: 'SELECT_ENV', env: 'testnet' })
    actor.send({ type: 'DEPLOYMENTS_LOADED' })
    actor.send({ type: 'LIVE_MARKETS_LOADED', totalMarkets: 15 })
    actor.send({ type: 'SUBMIT_DRAFT' })
    actor.send({ type: 'VALIDATION_PASSED' })
    actor.send({ type: 'MULTISEND_BUILT' })

    expect(actor.getSnapshot().value).toBe('readyForSafe')
  })

  it('blocks review link creation without an authenticated GitHub session', () => {
    const actor = startMachine()
    actor.send({ type: 'SELECT_ENV', env: 'mainnet' })
    actor.send({ type: 'DEPLOYMENTS_LOADED' })
    actor.send({ type: 'LIVE_MARKETS_LOADED', totalMarkets: 15 })
    actor.send({ type: 'SUBMIT_DRAFT' })
    actor.send({ type: 'VALIDATION_PASSED' })
    actor.send({ type: 'MULTISEND_BUILT' })
    actor.send({ type: 'SHADOW_PASSED' })
    actor.send({ type: 'CREATE_REVIEW_LINK', authenticated: false })

    expect(actor.getSnapshot().value).toBe('shadowPassed')
    expect(actor.getSnapshot().context.lastError).toMatch(/GitHub session/)
  })

  it('does not submit a Safe proposal before readyForSafe', () => {
    const actor = startMachine()
    actor.send({ type: 'SUBMIT_SAFE_PROPOSAL' })

    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('tracks shadow failure and lets the user return to editing', () => {
    const actor = startMachine()
    actor.send({ type: 'SELECT_ENV', env: 'mainnet' })
    actor.send({ type: 'DEPLOYMENTS_LOADED' })
    actor.send({ type: 'LIVE_MARKETS_LOADED', totalMarkets: 15 })
    actor.send({ type: 'SUBMIT_DRAFT' })
    actor.send({ type: 'VALIDATION_PASSED' })
    actor.send({ type: 'MULTISEND_BUILT' })
    actor.send({ type: 'SHADOW_FAILED', error: 'reverted: unauthorized' })

    expect(actor.getSnapshot().value).toBe('shadowFailed')
    expect(actor.getSnapshot().context.lastError).toBe('reverted: unauthorized')

    actor.send({ type: 'EDIT' })
    expect(actor.getSnapshot().value).toBe('editing')
  })
})
