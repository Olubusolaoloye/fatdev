/**
 * seo.ts — per-route metadata, in one place.
 *
 * This is a client-rendered SPA, which creates two problems search engines and
 * social crawlers care about:
 *
 *   1. Every route served the same index.html, so /pricing and
 *      /tools/security-scanner looked identical to a crawler — same title, same
 *      description. Google collapses near-duplicate pages, so extra routes were
 *      earning nothing.
 *
 *   2. Page content only exists after JavaScript runs. Googlebot renders JS,
 *      but slowly and not always; the social crawlers behind X, Telegram,
 *      Discord, LinkedIn and Slack do not run it at all.
 *
 * Both are addressed by baking real metadata into static HTML per route at
 * build time (see scripts/prerender.mjs), driven by the table below. The same
 * table feeds useSeo() so client-side navigation keeps the head in step.
 *
 * Descriptions here become the snippet under the search result. They are
 * written to be read by a person deciding whether to click, not stuffed with
 * keywords — Google has ignored the keywords meta since 2009, and thin
 * keyword-matched copy loses to copy that answers the query.
 */

export const SITE_URL = (import.meta?.env?.VITE_APP_URL ?? 'https://fatdev.org').replace(/\/$/, '')
export const SITE_NAME = 'FatDev'
export const DEFAULT_OG_IMAGE = '/logo-full.png'

export type RouteSeo = {
  path: string
  title: string
  description: string
  /** Omit to use DEFAULT_OG_IMAGE. Must be a site-root-relative path. */
  image?: string
  /** Kept out of the sitemap and marked noindex. */
  noindex?: boolean
  /** Rough crawl priority, 0–1. */
  priority?: number
}

/**
 * Every public route.
 *
 * Titles lead with the specific thing the page does, then the brand — a SERP
 * title is truncated around 60 characters and the leading words carry the most
 * weight, so "FatDev — …" on every page would waste that space.
 */
export const ROUTES: RouteSeo[] = [
  {
    path: '/',
    title: 'FatDev — Build, Secure, Bridge & Grow',
    description:
      'Create and deploy ERC-20 and BEP-20 tokens on 9 chains without writing Solidity. '
      + 'Free honeypot and rug-pull scanning, airdrops, cross-chain bridging and audit reports.',
    priority: 1.0,
  },
  {
    path: '/tools/security-scanner',
    title: 'Free Token Security Scanner — Honeypot & Rug Check | FatDev',
    description:
      'Paste any token address for a free security audit. Honeypot simulation, buy and sell tax, '
      + 'liquidity lock, ownership and holder distribution, scored 0–100. Works on EVM chains, Solana and Sui — '
      + 'the network is detected automatically.',
    priority: 0.9,
  },
  {
    path: '/tools/audit-score',
    title: 'Token Audit Score with PDF Report | FatDev',
    description:
      'Score any token against its own chain’s risk model and download a shareable PDF audit report. '
      + 'Covers tax configuration, security flags, ownership and liquidity across EVM, Solana and Sui.',
    priority: 0.8,
  },
  {
    path: '/tools/social',
    title: 'Token Launch Post Generator for Telegram, X and Discord | FatDev',
    description:
      'Generate launch announcements, teasers, how-to-buy guides and safety posts for your token. '
      + 'Formatted for Telegram, X and Discord, with the right wallets and links per chain.',
    priority: 0.7,
  },
  {
    path: '/tools/airdrop',
    title: 'Multi-Send Token Airdrop Tool — Batch Transfer from CSV | FatDev',
    description:
      'Send tokens to hundreds of wallets from a CSV in one transaction. One approve, one disperse — '
      + 'far cheaper than sending transfers individually.',
    priority: 0.7,
  },
  {
    path: '/tools',
    title: 'Token Launch Toolkit — Scanner, Airdrops, Audits | FatDev',
    description:
      'Every tool for launching and protecting a token: free security scanning, audit scoring with PDF '
      + 'reports, batch airdrops and community post generation.',
    priority: 0.8,
  },
  {
    path: '/pricing',
    title: 'Pricing — Pay Per Deploy, No Subscription | FatDev',
    description:
      'No plans and no monthly fees. Token creation is $30, or $20 paid in $BLIN. Security scanning is free. '
      + 'Airdrops cost $3 plus $0.03 per recipient. USD prices convert to the connected chain’s coin at the live rate.',
    priority: 0.9,
  },
  {
    path: '/bridge',
    title: 'Cross-Chain Token Bridge | FatDev',
    description:
      'Move any token between chains with the best route chosen automatically across 20+ bridges and DEXs. '
      + 'Live quotes, transparent fees and per-step confirmation tracking.',
    priority: 0.7,
  },
  // App surfaces: thin, wallet-specific, or duplicated per user. Nothing here
  // would ever be a useful search result, and indexing them dilutes the rest.
  { path: '/app', title: 'Deploy a Token | FatDev', description: 'Token deployment wizard.', noindex: true },
  { path: '/dashboard', title: 'Dashboard | FatDev', description: 'Your deployments and payment history.', noindex: true },
]

export const ROUTE_BY_PATH: Record<string, RouteSeo> =
  Object.fromEntries(ROUTES.map(r => [r.path, r]))

/** Absolute URL for a site-root-relative path. Crawlers reject relative og:image. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Structured data describing the product.
 *
 * Gives search engines an explicit machine-readable statement of what this is,
 * what it costs and who publishes it, rather than leaving them to infer it from
 * JavaScript-rendered markup.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/logo.png'),
    description:
      'No-code platform for deploying, auditing and launching ERC-20 and BEP-20 tokens across 9 chains.',
  }
}

export function softwareAppJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any modern browser',
    description:
      'Deploy ERC-20 and BEP-20 tokens without code, scan any token for honeypots and rug-pull risk, '
      + 'run airdrops, and bridge across chains.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Token Creator',
        price: '30',
        priceCurrency: 'USD',
        description: 'Deploy an audited token contract on any supported chain.',
      },
      {
        '@type': 'Offer',
        name: 'Security Scan',
        price: '0',
        priceCurrency: 'USD',
        description: 'Full token security audit with a 0–100 score.',
      },
    ],
  }
}

/**
 * FAQ entries. These can win an expanded search result, and they answer the
 * long-tail questions people actually type ("is this token a honeypot").
 * Every answer must be true of the product as it stands — fabricated FAQ markup
 * is a manual-action risk, not just a wasted opportunity.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I check if a token is a honeypot?',
    a: 'Paste the token’s contract address into the FatDev security scanner. It runs a sell simulation '
      + 'and reports whether the token can actually be sold, alongside buy and sell tax, liquidity lock '
      + 'status and ownership. Scanning is free and does not require a wallet.',
  },
  {
    q: 'Can I create a token without knowing how to code?',
    a: 'Yes. FatDev generates and deploys the contract for you from a guided form — you choose the name, '
      + 'supply, taxes and protections, and it compiles and deploys from your browser. No Solidity required.',
  },
  {
    q: 'Which blockchains does FatDev support?',
    a: 'Token deployment is available on 9 chains including Ethereum, BNB Chain and Arbitrum. '
      + 'The security scanner additionally covers Solana and Sui, detecting the network automatically '
      + 'from the address you paste.',
  },
  {
    q: 'How much does it cost to deploy a token?',
    a: 'Token creation is $30, or $20 when paid in $BLIN, plus the network’s own gas fee. There is no '
      + 'subscription — you pay per deployment. Security scanning is free.',
  },
]
