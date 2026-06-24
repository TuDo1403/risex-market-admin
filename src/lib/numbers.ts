const WAD = 1_000_000_000_000_000_000n
const UINT64_MAX = (1n << 64n) - 1n

export function parseDecimalToRaw(input: string, decimals: number): bigint {
  const value = input.trim()

  if (!/^\d+(\.\d+)?$/.test(value)) {
    if (value.startsWith('-')) {
      throw new Error('value must be non-negative')
    }
    throw new Error(`invalid decimal: ${input}`)
  }

  const [integer, fraction = ''] = value.split('.')
  if (fraction.length > decimals) {
    throw new Error(`too many decimal places for ${decimals} decimals`)
  }

  const paddedFraction = fraction.padEnd(decimals, '0')
  const rawText = `${integer}${paddedFraction}`.replace(/^0+(?=\d)/, '')

  return BigInt(rawText || '0')
}

export function formatRawDecimal(raw: bigint, decimals: number): string {
  if (raw < 0n) {
    throw new Error('raw value must be non-negative')
  }

  if (decimals === 0) {
    return raw.toString()
  }

  const scale = 10n ** BigInt(decimals)
  const integer = raw / scale
  const fraction = raw % scale

  if (fraction === 0n) {
    return integer.toString()
  }

  return `${integer}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`
}

export function mmrPercentToMaintenanceMarginFactor(percent: string): bigint {
  const percentRaw = parseDecimalToRaw(percent, 18)
  if (percentRaw === 0n) {
    throw new Error('MMR percent must be greater than zero')
  }

  const numerator = 100n * WAD * WAD
  return numerator / percentRaw
}

export function maintenanceMarginFactorToMmrPercent(
  maintenanceMarginFactor: bigint,
  decimals = 18,
): string {
  if (maintenanceMarginFactor <= 0n) {
    throw new Error('maintenance margin factor must be greater than zero')
  }

  const numerator = 100n * WAD * 10n ** BigInt(decimals)
  return formatRawDecimal(numerator / maintenanceMarginFactor, decimals)
}

export function parseBps(input: string, unit: 'bps' | 'percent'): bigint {
  if (unit === 'bps') {
    const raw = parseDecimalToRaw(input, 18)
    if (raw % WAD !== 0n) {
      throw new Error('bps input must resolve to integer bps')
    }
    return raw / WAD
  }

  const percentRaw = parseDecimalToRaw(input, 18)
  const numerator = percentRaw * 100n
  if (numerator % WAD !== 0n) {
    throw new Error('percent input must resolve to integer bps')
  }
  return numerator / WAD
}

export function parseImpactBaseUsdc(input: string): bigint {
  const value = parseDecimalToRaw(input, 1)
  if (value % 10n !== 0n) {
    throw new Error('impact base must be a whole USDC amount')
  }

  const wholeUsdc = value / 10n
  if (wholeUsdc > UINT64_MAX) {
    throw new Error('impact base exceeds uint64')
  }

  return wholeUsdc
}
