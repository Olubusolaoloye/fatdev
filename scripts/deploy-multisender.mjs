#!/usr/bin/env node
/**
 * deploy-multisender.mjs — deploy FatAirdrop.sol to every supported chain.
 *
 * Your private key is read from a local .env, is never printed, and never
 * leaves this machine. Nothing is sent anywhere except the RPC endpoints below.
 *
 *   1.  cp .env.example .env      (if you have not already)
 *   2.  add DEPLOYER_PRIVATE_KEY=0x...   to .env
 *   3.  node scripts/deploy-multisender.mjs              # dry run, sends nothing
 *   4.  node scripts/deploy-multisender.mjs --confirm    # actually deploys
 *
 * Useful flags:
 *   --confirm            actually broadcast (without it, nothing is sent)
 *   --only 56,1,8453     restrict to specific chain ids
 *   --skip 369           exclude specific chain ids
 *   --testnet            include BSC Testnet (excluded by default)
 *
 * The script skips any chain whose address is already filled in
 * FATDEV_MULTISENDER, so re-running it is safe and only fills the gaps.
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createWalletClient, http, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  mainnet, bsc, bscTestnet, arbitrum, polygon, base, optimism, avalanche,
  linea, mantle, sei, gnosis, cronos, pulsechain, sonic, hyperEvm, monad,
  loop, plasma, stable,
} from 'viem/chains'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Chain table ───────────────────────────────────────────────────────────────
const robinhood = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'] } },
}

const CHAINS = [
  { chain: bsc,        rpc: 'https://bsc-dataseed.binance.org' },
  { chain: mainnet,    rpc: 'https://eth.llamarpc.com' },
  { chain: arbitrum,   rpc: 'https://arb1.arbitrum.io/rpc' },
  { chain: base,       rpc: 'https://mainnet.base.org' },
  { chain: polygon,    rpc: 'https://polygon-rpc.com' },
  { chain: optimism,   rpc: 'https://mainnet.optimism.io' },
  { chain: avalanche,  rpc: 'https://api.avax.network/ext/bc/C/rpc' },
  { chain: linea,      rpc: null },
  { chain: hyperEvm,   rpc: null },
  { chain: sonic,      rpc: null },
  { chain: mantle,     rpc: null },
  { chain: sei,        rpc: null },
  { chain: gnosis,     rpc: null },
  { chain: cronos,     rpc: null },
  { chain: robinhood,  rpc: robinhood.rpcUrls.default.http[0] },
  { chain: monad,      rpc: null },
  { chain: pulsechain, rpc: null },
  { chain: plasma,     rpc: null },
  { chain: stable,     rpc: null },
  { chain: loop,       rpc: null },
  { chain: bscTestnet, rpc: 'https://bsc-testnet.publicnode.com', testnet: true },
]

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv    = process.argv.slice(2)
const CONFIRM = argv.includes('--confirm')
const TESTNET = argv.includes('--testnet')
const listArg = f => {
  const i = argv.indexOf(f)
  return i === -1 ? null : (argv[i + 1] ?? '').split(',').map(Number).filter(Boolean)
}
const ONLY = listArg('--only')
const SKIP = listArg('--skip') ?? []

const c = {
  dim:  s => `\x1b[2m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
  red:  s => `\x1b[31m${s}\x1b[0m`,
  grn:  s => `\x1b[32m${s}\x1b[0m`,
  yel:  s => `\x1b[33m${s}\x1b[0m`,
  cyn:  s => `\x1b[36m${s}\x1b[0m`,
}

// ── Read the bytecode + already-filled addresses from the app source ──────────
function readAirdropSource() {
  const file = fs.readFileSync(path.join(ROOT, 'src/lib/airdrop.ts'), 'utf8')

  const bc = file.match(/AIRDROP_BYTECODE = '(0x[0-9a-fA-F]+)'/)
  if (!bc) throw new Error('Could not find AIRDROP_BYTECODE in src/lib/airdrop.ts')

  // Existing entries, ignoring the commented-out placeholders
  const block = file.slice(file.indexOf('FATDEV_MULTISENDER'), file.indexOf('const STORAGE_KEY'))
  const existing = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(\d+)\s*:\s*'(0x[0-9a-fA-F]{40})'/)
    if (m) existing[Number(m[1])] = m[2]
  }
  return { bytecode: bc[1], existing }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) {
    console.error(c.red('\n  DEPLOYER_PRIVATE_KEY is not set.\n'))
    console.error('  Add it to ' + c.bold('.env') + ' in the project root:\n')
    console.error(c.dim('    DEPLOYER_PRIVATE_KEY=0xabc123...\n'))
    console.error('  .env is already gitignored — the key stays on this machine.\n')
    process.exit(1)
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    console.error(c.red('\n  DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hex characters.\n'))
    process.exit(1)
  }

  const account = privateKeyToAccount(pk)
  const { bytecode, existing } = readAirdropSource()

  let targets = CHAINS.filter(t => TESTNET || !t.testnet)
  if (ONLY) targets = targets.filter(t => ONLY.includes(t.chain.id))
  if (SKIP.length) targets = targets.filter(t => !SKIP.includes(t.chain.id))

  console.log()
  console.log(c.bold('  FatAirdrop multi-sender deploy'))
  console.log(c.dim('  ─'.repeat(38)))
  console.log(`  Deployer   ${c.cyn(account.address)}`)
  console.log(`  Bytecode   ${bytecode.length / 2 - 1} bytes`)
  console.log(`  Chains     ${targets.length}${TESTNET ? ' (incl. testnet)' : ''}`)
  console.log(`  Mode       ${CONFIRM ? c.yel('LIVE — will broadcast') : c.grn('dry run — nothing will be sent')}`)
  console.log()

  const results = []

  for (const { chain, rpc } of targets) {
    const url   = rpc ?? chain.rpcUrls?.default?.http?.[0]
    const label = `${chain.name} (${chain.id})`.padEnd(30)

    if (existing[chain.id]) {
      console.log(`  ${label} ${c.dim('skip — already in FATDEV_MULTISENDER')}`)
      results.push({ chain, address: existing[chain.id], status: 'existing' })
      continue
    }
    if (!url) {
      console.log(`  ${label} ${c.yel('skip — no RPC url')}`)
      results.push({ chain, status: 'no-rpc' })
      continue
    }

    try {
      const pub = createPublicClient({ chain, transport: http(url, { timeout: 20_000 }) })

      const [balance, gasPrice] = await Promise.all([
        pub.getBalance({ address: account.address }),
        pub.getGasPrice().catch(() => null),
      ])

      let gas = null
      try {
        gas = await pub.estimateGas({ account: account.address, data: bytecode })
      } catch { /* some chains refuse to estimate without funds */ }

      const cost = gas && gasPrice ? gas * gasPrice : null
      const sym  = chain.nativeCurrency?.symbol ?? 'ETH'
      const costStr = cost ? `~${Number(formatEther(cost)).toFixed(6)} ${sym}` : 'unknown'

      if (cost && balance < cost) {
        console.log(`  ${label} ${c.red('insufficient funds')} ${c.dim(
          `have ${Number(formatEther(balance)).toFixed(6)} ${sym}, need ${costStr}`)}`)
        results.push({ chain, status: 'underfunded' })
        continue
      }

      if (!CONFIRM) {
        console.log(`  ${label} ${c.grn('ready')} ${c.dim(
          `balance ${Number(formatEther(balance)).toFixed(6)} ${sym} · cost ${costStr}`)}`)
        results.push({ chain, status: 'ready' })
        continue
      }

      const wallet = createWalletClient({ account, chain, transport: http(url, { timeout: 20_000 }) })
      process.stdout.write(`  ${label} ${c.dim('deploying…')}`)

      const hash = await wallet.sendTransaction({
        data: bytecode,
        gas: gas ? (gas * 120n) / 100n : undefined,
        chain: null,
      })
      const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 })

      if (!receipt.contractAddress) throw new Error('no contractAddress in receipt')
      process.stdout.write(`\r  ${label} ${c.grn(receipt.contractAddress)}\n`)
      results.push({ chain, address: receipt.contractAddress, status: 'deployed', hash })

    } catch (e) {
      const msg = (e?.shortMessage ?? e?.message ?? String(e)).split('\n')[0].slice(0, 70)
      console.log(`  ${label} ${c.red('failed')} ${c.dim(msg)}`)
      results.push({ chain, status: 'failed', error: msg })
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const withAddr = results.filter(r => r.address)
  console.log()
  console.log(c.dim('  ─'.repeat(38)))

  if (!CONFIRM) {
    const ready = results.filter(r => r.status === 'ready').length
    console.log(`  ${ready} chain${ready === 1 ? '' : 's'} ready to deploy.`)
    console.log(`  Re-run with ${c.bold('--confirm')} to broadcast.\n`)
    return
  }

  if (withAddr.length) {
    console.log(c.bold('\n  Paste into FATDEV_MULTISENDER in src/lib/airdrop.ts:\n'))
    console.log('export const FATDEV_MULTISENDER: Record<number, `0x${string}`> = {')
    for (const r of withAddr) {
      const pad = String(r.chain.id).padEnd(6)
      console.log(`  ${pad}: '${r.address}',  // ${r.chain.name}`)
    }
    console.log('}\n')

    fs.writeFileSync(
      path.join(ROOT, 'multisender-addresses.json'),
      JSON.stringify(
        Object.fromEntries(withAddr.map(r => [r.chain.id, r.address])),
        null, 2
      )
    )
    console.log(c.dim('  Also written to multisender-addresses.json\n'))
  }

  const failed = results.filter(r => r.status === 'failed' || r.status === 'underfunded')
  if (failed.length) {
    console.log(c.yel(`  ${failed.length} chain(s) did not deploy — fund them and re-run.`))
    console.log(c.dim('  Already-deployed chains are skipped automatically.\n'))
  }
}

main().catch(e => {
  console.error(c.red(`\n  ${e.message}\n`))
  process.exit(1)
})
