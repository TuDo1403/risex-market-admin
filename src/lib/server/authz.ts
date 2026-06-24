import type { NextRequest } from 'next/server'

export type MarketAdminSession = {
  githubId: string
  login: string
  avatarUrl?: string
}

export async function requireMarketAdminSession(
  request?: NextRequest,
): Promise<MarketAdminSession | null> {
  if (process.env.MARKET_ADMIN_TEST_AUTH === '1') {
    const login = request?.headers.get('x-test-github-login')
    if (!login) {
      return null
    }

    return {
      githubId: `test:${login}`,
      login,
      avatarUrl: `https://github.com/${login}.png`,
    }
  }

  const { auth } = await import('@/auth')
  const session = await auth()
  const user = session?.user
  if (!user?.email && !user?.name) {
    return null
  }

  return {
    githubId: user.email ?? user.name ?? 'github:unknown',
    login: user.name ?? user.email ?? 'github-user',
    avatarUrl: user.image ?? undefined,
  }
}
