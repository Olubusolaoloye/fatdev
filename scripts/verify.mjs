/**
 * Verify FatTokenV6 on BSCScan (or any Etherscan-compatible explorer).
 *
 * Usage:
 *   node scripts/verify.mjs <contractAddress> [chainId] [apiKey]
 *
 * Examples:
 *   node scripts/verify.mjs 0xAbc...  56   YOUR_BSCSCAN_KEY
 *   node scripts/verify.mjs 0xAbc...  97   YOUR_BSCSCAN_KEY   (testnet)
 *   node scripts/verify.mjs 0xAbc...  1    YOUR_ETHERSCAN_KEY (mainnet)
 *
 * Chain IDs:
 *   56  = BSC Mainnet  → bscscan.com
 *   97  = BSC Testnet  → testnet.bscscan.com
 *   1   = Ethereum     → etherscan.io
 *   42161 = Arbitrum   → arbiscan.io
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Args ──────────────────────────────────────────────────────────────────────
const [,, contractAddress, chainIdArg = '56', apiKeyArg] = process.argv

if (!contractAddress || !contractAddress.startsWith('0x')) {
  console.error('Usage: node scripts/verify.mjs <0xContractAddress> [chainId] [apiKey]')
  process.exit(1)
}

const chainId = Number(chainIdArg)
const apiKey  = apiKeyArg || process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || ''

if (!apiKey) {
  console.error('No API key provided. Pass it as 3rd argument or set BSCSCAN_API_KEY env var.')
  console.error('Get a free key at: https://bscscan.com/myapikey')
  process.exit(1)
}

// ── API base URLs ─────────────────────────────────────────────────────────────
// Etherscan V2 unified endpoint — chainId passed as query param
const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api'

const API_URLS = {
  56:    ETHERSCAN_V2,
  97:    ETHERSCAN_V2,
  1:     ETHERSCAN_V2,
  42161: ETHERSCAN_V2,
}

const apiUrl = API_URLS[chainId]
if (!apiUrl) {
  console.error(`Unsupported chainId: ${chainId}. Supported: ${Object.keys(API_URLS).join(', ')}`)
  process.exit(1)
}

// ── Source code ───────────────────────────────────────────────────────────────
const sourcePath = path.join(__dirname, '..', 'src', 'contracts', 'FatTokenV6.sol')
const sourceCode = fs.readFileSync(sourcePath, 'utf8')

// ── Constructor ABI encode the deployment args ─────────────────────────────────
// NOTE: If your deployment used non-default constructor args, update these.
// These are the DEFAULT values used by FatDeploy wizard.
// You can also leave constructorArguments blank and BSCScan will try to auto-detect.
const constructorArguments = '' // leave blank — BSCScan will auto-detect from tx input

// ── Verification payload ───────────────────────────────────────────────────────
// chainid goes in the URL, not the POST body (Etherscan V2)
const params = new URLSearchParams({
  apikey:               apiKey,
  module:               'contract',
  action:               'verifysourcecode',
  contractaddress:      contractAddress,
  sourceCode:           sourceCode,
  codeformat:           'solidity-single-file',
  contractname:         'FatTokenV6',
  compilerversion:      'v0.8.4+commit.c7e474f2',
  optimizationUsed:     '1',
  runs:                 '200',
  constructorArguements: constructorArguments,
  licenseType:          '1', // MIT
})

console.log(`\nVerifying FatTokenV6 at ${contractAddress} on chain ${chainId}...`)
console.log(`API: ${apiUrl}\n`)

// ── Submit ─────────────────────────────────────────────────────────────────────
// chainid in URL per Etherscan V2 spec
const res = await fetch(`${apiUrl}?chainid=${chainId}`, {
  method: 'POST',
  body:   params,
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
})

const data = await res.json()
console.log('Submit response:', JSON.stringify(data, null, 2))

if (data.status !== '1') {
  console.error('\nVerification submission failed.')
  console.error('Message:', data.result)
  process.exit(1)
}

const guid = data.result
console.log(`\nSubmission accepted. GUID: ${guid}`)
console.log('Polling for result (this can take 20-60 seconds)...\n')

// ── Poll for result ────────────────────────────────────────────────────────────
async function poll(guid, retries = 20) {
  for (let i = 0; i < retries; i++) {
    await new Promise(r => setTimeout(r, 5000)) // wait 5s between polls

    const r = await fetch(`${apiUrl}?chainid=${chainId}&${new URLSearchParams({
      apikey:  apiKey,
      module:  'contract',
      action:  'checkverifystatus',
      guid,
    })}`)

    const d = await r.json()
    console.log(`[${i + 1}/${retries}] Status: ${d.result}`)

    if (d.result === 'Pass - Verified') {
      const explorerBase = {
        56:    'https://bscscan.com',
        97:    'https://testnet.bscscan.com',
        1:     'https://etherscan.io',
        42161: 'https://arbiscan.io',
      }[chainId]

      console.log(`\n✅ Verified!\n${explorerBase}/address/${contractAddress}#code\n`)
      return true
    }

    if (d.result && !d.result.includes('Pending')) {
      console.error(`\n❌ Verification failed: ${d.result}`)
      return false
    }
  }

  console.warn('\nTimed out waiting for verification. Check BSCScan manually.')
  return false
}

await poll(guid)
