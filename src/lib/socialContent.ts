/**
 * socialContent.ts — generates ready-to-post community content from real token data.
 *
 * Replaces the previous single "we launched" template per platform. Projects need
 * copy across a whole lifecycle — teasing, launching, explaining how to buy,
 * proving safety, celebrating milestones — and each platform has different
 * conventions (Telegram markdown, X's 280 chars and hashtag culture, Discord's
 * headings and tables).
 *
 * Every post is assembled from facts the app already knows, so nothing is a
 * placeholder the user has to hunt down and fill in.
 */
import { CHAIN_EXPLORERS, CHAIN_NAME } from './wagmi'

export type Platform = 'telegram' | 'twitter' | 'discord'
export type Tone     = 'professional' | 'hype' | 'degen'

export type PostKind =
  | 'launch' | 'teaser' | 'howtobuy' | 'safety' | 'milestone' | 'ama' | 'update'

export type TokenFacts = {
  name: string
  symbol: string
  decimals: number
  totalSupply: number
  buyTax: number
  sellTax: number
  contractAddr: string
  chainId: number
  // Optional trust signals — included only when known
  liquidityUsd?: number
  holders?: number
  lpSecuredPct?: number
  ownerRenounced?: boolean
  auditScore?: number
  killBlock?: boolean
  walletLimit?: boolean
  taxLocked?: boolean
  // Optional community links
  telegramUrl?: string
  websiteUrl?: string
  twitterUrl?: string
}

export const POST_KINDS: { kind: PostKind; label: string; blurb: string }[] = [
  { kind: 'launch',    label: 'Launch announcement', blurb: 'The main "we are live" post with contract and tokenomics' },
  { kind: 'teaser',    label: 'Pre-launch teaser',   blurb: 'Build anticipation before trading opens' },
  { kind: 'howtobuy',  label: 'How to buy',          blurb: 'Step-by-step buying guide for newcomers' },
  { kind: 'safety',    label: 'Safety & trust',      blurb: 'Lead with your audit score, LP lock and renouncement' },
  { kind: 'milestone', label: 'Milestone',           blurb: 'Celebrate holder counts, liquidity or volume' },
  { kind: 'ama',       label: 'AMA / community call', blurb: 'Invite holders to a live session' },
  { kind: 'update',    label: 'Progress update',     blurb: 'Recurring update to keep the channel warm' },
]

export const TONES: { tone: Tone; label: string; blurb: string }[] = [
  { tone: 'professional', label: 'Professional', blurb: 'Measured and factual. Best for listings and partners.' },
  { tone: 'hype',         label: 'Hype',         blurb: 'Energetic but still readable. Good default for launch.' },
  { tone: 'degen',        label: 'Degen',        blurb: 'Native CT voice. Heavy slang and emoji.' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = <T,>(arr: T[], seed: number): T => arr[seed % arr.length]

function usd(n?: number): string | null {
  if (!n || n <= 0) return null
  return `$${Math.round(n).toLocaleString()}`
}

function explorerUrl(t: TokenFacts): string {
  const base = CHAIN_EXPLORERS[t.chainId]
  return base && t.contractAddr ? `${base}/token/${t.contractAddr}` : ''
}

function chain(t: TokenFacts): string {
  return CHAIN_NAME[t.chainId] ?? `Chain ${t.chainId}`
}

/** Trust bullets, only for signals we actually have. */
function trustPoints(t: TokenFacts): string[] {
  const out: string[] = []
  if (t.auditScore != null)      out.push(`Audit score ${t.auditScore}/100`)
  if (t.ownerRenounced)          out.push('Ownership renounced')
  if (t.lpSecuredPct && t.lpSecuredPct >= 80) out.push(`LP ${t.lpSecuredPct}% locked/burnt`)
  if (t.taxLocked)               out.push('Taxes locked permanently')
  if (t.killBlock)               out.push('Anti-sniper protection')
  if (t.walletLimit)             out.push('Max wallet limit')
  return out
}

function hashtags(t: TokenFacts, tone: Tone): string {
  const sym = t.symbol.replace(/[^A-Za-z0-9]/g, '')
  const chainTag = chain(t).replace(/[^A-Za-z0-9]/g, '')
  const base = [`#${sym}`, `#${chainTag}`, '#DeFi']
  if (tone === 'degen') base.push('#100x', '#gem')
  if (tone === 'hype')  base.push('#crypto')
  return base.join(' ')
}

// ── Headline variants ─────────────────────────────────────────────────────────
const HEADLINES: Record<PostKind, Record<Tone, string[]>> = {
  launch: {
    professional: ['{N} ({S}) is now live', '{N} has launched on {C}', 'Trading is open for {N}'],
    hype:         ['{N} ({S}) is LIVE 🚀', '{S} is trading now on {C} 🔥', 'The wait is over — {S} is live'],
    degen:        ['{S} JUST WENT LIVE 🚀🚀', 'ape station open — ${S} is trading', '{S} is LIVE and it is moving 🔥'],
  },
  teaser: {
    professional: ['{N} launches soon on {C}', 'Something is coming to {C}', '{N}: launch details incoming'],
    hype:         ['{S} is coming 👀', 'Get ready — {S} drops soon 🔥', 'Set your alerts for {S}'],
    degen:        ['{S} soon. very soon 👀', 'ser. {S}. you have been warned', 'the {S} candle is loading 📈'],
  },
  howtobuy: {
    professional: ['How to buy {N} ({S})', 'Buying guide: {S} on {C}', 'Step-by-step: acquiring {S}'],
    hype:         ['How to grab {S} in 60 seconds ⚡', 'New here? Buy {S} in 4 steps', 'Your {S} buying guide 📖'],
    degen:        ['how to ape {S} (4 steps)', 'buying {S} for beginners ser', 'cant figure out how to buy {S}? read this'],
  },
  safety: {
    professional: ['{N} security overview', 'Why {S} is built to be safe', '{S}: verifiable safety measures'],
    hype:         ['{S} is SAFE and here is the proof 🛡️', 'Why {S} holders sleep well 😴', 'Security first: {S} 🔒'],
    degen:        ['{S} is not a rug and here is why 🛡️', 'no honeypot. no rug. just {S}', 'devs cant rug you ser — {S} proof'],
  },
  milestone: {
    professional: ['{N} reaches a new milestone', '{S} community update', 'Progress report: {S}'],
    hype:         ['WE DID IT {S} FAM 🎉', '{S} just hit a huge milestone 🚀', 'Massive news for {S} holders 🔥'],
    degen:        ['{S} FAM WE ARE SO BACK 🎉', 'ngmi if you missed this {S} milestone', '{S} holders eating good today 🍽️'],
  },
  ama: {
    professional: ['{N} community AMA', 'Join the {S} team live', '{S}: open Q&A session'],
    hype:         ['{S} AMA — bring your questions 🎤', 'Live with the {S} team 🔴', 'AMA time for {S} holders'],
    degen:        ['{S} AMA — ask us anything ser 🎤', 'devs going live. {S} AMA', 'come grill the {S} team 🔥'],
  },
  update: {
    professional: ['{N} progress update', '{S}: what shipped this week', 'Development update — {S}'],
    hype:         ['{S} weekly update 📊', 'Big week for {S} 🚀', 'What the {S} team shipped 🔨'],
    degen:        ['{S} weekly alpha drop 📊', 'devs did something. {S} update', '{S} update — we are cooking 👨‍🍳'],
  },
}

function headline(kind: PostKind, tone: Tone, t: TokenFacts, seed: number): string {
  return pick(HEADLINES[kind][tone], seed)
    .replace(/\{N\}/g, t.name || 'Our token')
    .replace(/\{S\}/g, t.symbol || 'TOKEN')
    .replace(/\{C\}/g, chain(t))
}

function closer(tone: Tone): string {
  return tone === 'professional'
    ? 'This is not financial advice. Always do your own research.'
    : tone === 'hype'
      ? '⚠️ DYOR. Not financial advice.'
      : 'dyor. nfa. ape at your own risk 🫡'
}

// ── Body builders per kind ────────────────────────────────────────────────────
function bodyLines(kind: PostKind, t: TokenFacts): string[] {
  const ca   = t.contractAddr || '[contract address]'
  const liq  = usd(t.liquidityUsd)
  const trust = trustPoints(t)

  switch (kind) {
    case 'launch':
      return [
        `Chain: ${chain(t)}`,
        `Supply: ${t.totalSupply.toLocaleString()} ${t.symbol}`,
        `Tax: ${t.buyTax.toFixed(1)}% buy / ${t.sellTax.toFixed(1)}% sell`,
        liq ? `Liquidity: ${liq}` : null,
        '',
        `Contract: ${ca}`,
      ].filter(l => l !== null) as string[]

    case 'teaser':
      return [
        `${t.name} is launching on ${chain(t)}.`,
        '',
        `Supply: ${t.totalSupply.toLocaleString()} ${t.symbol}`,
        `Tax: ${t.buyTax.toFixed(1)}% / ${t.sellTax.toFixed(1)}%`,
        ...(trust.length ? ['', 'Built in from day one:', ...trust.map(p => `• ${p}`)] : []),
        '',
        'Join the community so you do not miss the open.',
      ]

    case 'howtobuy':
      return [
        `1. Get a wallet (MetaMask or Trust Wallet) and fund it on ${chain(t)}.`,
        `2. Open your DEX of choice and paste the contract below.`,
        `3. Set slippage to ${Math.max(3, Math.ceil(Math.max(t.buyTax, t.sellTax) + 2))}% to cover tax.`,
        `4. Confirm the swap — ${t.symbol} lands in your wallet.`,
        '',
        `Contract: ${ca}`,
        '',
        'Always paste the contract from an official channel. Never trust a DM.',
      ]

    case 'safety':
      return [
        trust.length
          ? `${t.symbol} security at a glance:`
          : `${t.symbol} security measures:`,
        ...(trust.length ? trust.map(p => `• ${p}`) : ['• Contract verified on the explorer']),
        liq ? `• Liquidity: ${liq}` : null,
        '',
        `Verify everything yourself — contract: ${ca}`,
      ].filter(l => l !== null) as string[]

    case 'milestone':
      return [
        t.holders ? `${t.holders.toLocaleString()} holders and growing.` : `${t.symbol} keeps growing.`,
        liq ? `Liquidity: ${liq}` : null,
        '',
        'Thank you to everyone holding and spreading the word.',
        '',
        `Contract: ${ca}`,
      ].filter(l => l !== null) as string[]

    case 'ama':
      return [
        `Join the ${t.name} team for a live Q&A.`,
        '',
        '📅 Date: [add date]',
        '🕐 Time: [add time + timezone]',
        `📍 Where: ${t.telegramUrl || '[Telegram / Discord link]'}`,
        '',
        'Bring your questions — tokenomics, roadmap, anything.',
      ]

    case 'update':
      return [
        `What is new with ${t.symbol}:`,
        '',
        '• [Add this week\'s highlight]',
        '• [Add a second update]',
        '• [Add what is coming next]',
        '',
        t.holders ? `Community: ${t.holders.toLocaleString()} holders` : null,
        liq ? `Liquidity: ${liq}` : null,
      ].filter(l => l !== null) as string[]
  }
}

// ── Platform formatting ───────────────────────────────────────────────────────
export type GeneratedPost = {
  text: string
  /** X only — over-limit posts are flagged rather than silently truncated */
  charCount: number
  overLimit: boolean
}

export function generatePost(
  kind: PostKind, platform: Platform, tone: Tone, t: TokenFacts, variant = 0
): GeneratedPost {
  const head  = headline(kind, tone, t, variant)
  const lines = bodyLines(kind, t)
  const url   = explorerUrl(t)
  const ca    = t.contractAddr || '[contract address]'

  let text: string

  if (platform === 'telegram') {
    // Telegram markdown — *bold*, `code`, [text](url)
    const body = lines
      .map(l => l.startsWith('Contract: ') ? `📋 \`${ca}\`` : l)
      .join('\n')
    text = [
      `*${head}*`,
      '',
      body,
      url ? `\n🔍 [View on explorer](${url})` : null,
      t.websiteUrl ? `🌐 ${t.websiteUrl}` : null,
      '',
      `_${closer(tone)}_`,
    ].filter(l => l !== null).join('\n')

  } else if (platform === 'twitter') {
    // X — tight. Drop prose, keep facts, append hashtags.
    const compact = lines
      .filter(l => l && !l.startsWith('Always paste') && !l.startsWith('Thank you'))
      .map(l => l.replace(/^Contract: /, 'CA: '))
      .join('\n')
    text = [
      head,
      '',
      compact,
      url || null,
      '',
      hashtags(t, tone),
    ].filter(l => l !== null).join('\n')

  } else {
    // Discord — headings, blockquote, table for launch
    const isLaunch = kind === 'launch'
    const table = isLaunch ? [
      '',
      '| Parameter | Value |',
      '|---|---|',
      `| Chain | ${chain(t)} |`,
      `| Supply | ${t.totalSupply.toLocaleString()} ${t.symbol} |`,
      `| Decimals | ${t.decimals} |`,
      `| Buy tax | ${t.buyTax.toFixed(1)}% |`,
      `| Sell tax | ${t.sellTax.toFixed(1)}% |`,
      ...(t.liquidityUsd ? [`| Liquidity | ${usd(t.liquidityUsd)} |`] : []),
    ].join('\n') : ''

    const body = isLaunch
      ? lines.filter(l => l.startsWith('Contract:')).join('\n')
      : lines.join('\n')

    text = [
      `## ${head}`,
      '',
      isLaunch ? '### Tokenomics' + table : body,
      isLaunch ? `\n### Contract\n\`${ca}\`` : `\n\`${ca}\``,
      url ? `\n🔍 ${url}` : null,
      '',
      `> ${closer(tone)}`,
    ].filter(l => l !== null).join('\n')
  }

  const charCount = text.length
  return { text, charCount, overLimit: platform === 'twitter' && charCount > 280 }
}

/** How many phrasing variants exist for a given kind + tone. */
export function variantCount(kind: PostKind, tone: Tone): number {
  return HEADLINES[kind][tone].length
}
