/**
 * services.ts — the single source of truth for what each tool costs.
 *
 * Both the pricing page and the tools themselves read from here, so a fee shown
 * to a user and the fee actually charged cannot drift apart.
 *
 * All amounts are USD. The native amount is derived at payment time by
 * priceOracle, so a price means the same thing on every chain.
 */
import type { IconName } from '../components/ui-kit/Icon'
import type { FeatureKey } from './tools'
import { ROUTERS } from './wagmi'

/** Chains a token can actually be deployed to — those with a verified router. */
export const DEPLOYABLE_CHAIN_COUNT = Object.keys(ROUTERS).length

export type ServiceFee =
  | { kind: 'free' }
  | { kind: 'flat';    usd: number; blinUsd?: number }
  /** A base fee plus a charge scaled by units (e.g. airdrop recipients) */
  | { kind: 'metered'; usd: number; perUnitUsd: number; unitLabel: string }

export type Service = {
  key: string
  /** Ties the row to a feature flag so a disabled tool stops being advertised */
  feature?: FeatureKey
  icon: IconName
  title: string
  desc: string
  fee: ServiceFee
  /** Route the CTA points at */
  href: string
  cta: string
  /** Shown when the fee is not yet collected in-product */
  notYetCharged?: boolean
}

export const SERVICES: Service[] = [
  {
    key: 'creator',
    icon: 'zap',
    title: 'Token Creator',
    desc: `Deploy audited Standard, Tax, Deflationary or Reflection tokens on ${DEPLOYABLE_CHAIN_COUNT} chains — no code.`,
    fee: { kind: 'flat', usd: 30, blinUsd: 20 },
    href: '/app',
    cta: 'Create Token',
  },
  {
    key: 'scan',
    feature: 'scanner',
    icon: 'shield',
    title: 'Security Scan',
    desc: 'On-chain safety audit for any token — honeypot simulation, taxes, LP status and deployer reputation.',
    fee: { kind: 'free' },
    href: '/tools',
    cta: 'Scan a Token',
  },
  {
    key: 'airdrop',
    feature: 'airdrop',
    icon: 'send',
    title: 'Airdrop Tool',
    desc: 'Send tokens to hundreds of addresses in a single transaction, saving time and gas.',
    fee: { kind: 'metered', usd: 3, perUnitUsd: 0.03, unitLabel: 'recipient' },
    href: '/tools',
    cta: 'Send Tokens',
  },
  {
    key: 'audit',
    feature: 'audit',
    icon: 'file',
    title: 'Audit Score',
    desc: 'Score a token on taxes, security flags, verification and ownership. Download a branded PDF report.',
    fee: { kind: 'free' },
    href: '/tools',
    cta: 'Score a Token',
  },
  {
    key: 'social',
    feature: 'social',
    icon: 'megaphone',
    title: 'Social & Community',
    desc: 'Launch, teaser, how-to-buy and safety posts for Telegram, X and Discord, pre-filled with your tokenomics.',
    fee: { kind: 'free' },
    href: '/tools',
    cta: 'Generate Posts',
  },
  {
    key: 'bridge',
    feature: 'bridge',
    icon: 'bridge',
    title: 'Cross-Chain Bridge',
    desc: 'Move tokens between supported networks with live routing and confirmation tracking.',
    fee: { kind: 'free' },
    href: '/bridge',
    cta: 'Open Bridge',
  },
]

/** Headline figure for a fee, e.g. "$30" / "Free" / "$3". */
export function feeHeadline(fee: ServiceFee): string {
  if (fee.kind === 'free') return 'Free'
  return `$${fee.usd}`
}

/** Sub-line under the headline, or null when there is nothing to add. */
export function feeSubline(fee: ServiceFee): string | null {
  if (fee.kind === 'free')    return 'no service fee — you only pay network gas'
  if (fee.kind === 'flat')    return fee.blinUsd ? `$${fee.blinUsd} in $BLIN` : null
  return `+ $${fee.perUnitUsd.toFixed(2)} / ${fee.unitLabel}`
}

/** Total USD for a metered service at a given quantity. */
export function meteredTotalUsd(fee: ServiceFee, units: number): number {
  if (fee.kind !== 'metered') return fee.kind === 'flat' ? fee.usd : 0
  return fee.usd + fee.perUnitUsd * units
}
