import STANDARD_INPUT from '../contracts/standardInput.json'

// Etherscan API V2 — single endpoint, chainId param selects the chain
const VERIFY_API = 'https://api.etherscan.io/v2/api'
const API_KEY    = 'BHPP1DMU8YABI4Y9MV7PUGATK49IKR8D3F'

const COMPILER_VERSION = 'v0.8.20+commit.a1b79de6'

// Maps tokenType → "sourcePath:ContractName" format Etherscan expects for Standard JSON Input
const CONTRACT_NAME: Record<string, string> = {
  standard:     'contracts/FatStandard.sol:FatStandard',
  tax:          'contracts/FatTax.sol:FatTax',
  deflationary: 'contracts/FatDeflationary.sol:FatDeflationary',
  reflection:   'contracts/FatReflection.sol:FatReflection',
}

export async function verifyContract(
  contractAddress: string,
  tokenType: string,
  chainId: number,
  onStatus: (s: string) => void
): Promise<{ success: boolean; message: string }> {
  // Robinhood Chain uses Blockscout — no Etherscan API key required
  if (chainId === 4663) {
    return verifyBlockscout(contractAddress, tokenType, onStatus)
  }

  const contractName = CONTRACT_NAME[tokenType]
  if (!contractName) return { success: false, message: `Unknown token type: ${tokenType}` }

  onStatus('Submitting source code for verification…')

  const body = new URLSearchParams({
    apikey:              API_KEY,
    module:              'contract',
    action:              'verifysourcecode',
    contractaddress:     contractAddress,
    sourceCode:          JSON.stringify(STANDARD_INPUT),
    codeformat:          'solidity-standard-json-input',
    contractname:        contractName,
    compilerversion:     COMPILER_VERSION,
    constructorArguements: '',  // two-step deploy: no constructor args
    licenseType:         '3',  // MIT
  })

  let guid: string
  try {
    const res  = await fetch(`${VERIFY_API}?chainid=${chainId}`, { method: 'POST', body })
    const json = await res.json()

    if (json.status !== '1') {
      if (json.result?.toLowerCase().includes('already verified')) {
        return { success: true, message: 'Contract already verified.' }
      }
      return { success: false, message: `Submission failed: ${json.result ?? json.message}` }
    }
    guid = json.result as string
  } catch (e: any) {
    return { success: false, message: `Network error during submission: ${e.message}` }
  }

  // Poll for result — Etherscan takes 20–60 s
  onStatus('Waiting for verification result…')
  for (let attempt = 0; attempt < 24; attempt++) {
    await sleep(6000)
    try {
      const poll = await fetch(
        `${VERIFY_API}?chainid=${chainId}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${API_KEY}`
      )
      const json   = await poll.json()
      const result: string = json.result ?? ''

      if (result === 'Pass - Verified') {
        return { success: true, message: 'Contract verified successfully!' }
      }
      if (result.startsWith('Fail')) {
        return { success: false, message: `Verification failed: ${result}` }
      }
      if (result.toLowerCase().includes('already verified')) {
        return { success: true, message: 'Contract already verified.' }
      }
      onStatus(`Verification pending… (${result || 'checking'})`)
    } catch {
      // transient — keep polling
    }
  }

  return { success: false, message: 'Verification timed out. Check the block explorer manually.' }
}

// ── Blockscout verifier (Robinhood Chain, chain 4663) ─────────────────────────
// No API key required. Uses Blockscout's Etherscan-compatible API endpoint.
async function verifyBlockscout(
  contractAddress: string,
  tokenType: string,
  onStatus: (s: string) => void
): Promise<{ success: boolean; message: string }> {
  const contractName = CONTRACT_NAME[tokenType]
  if (!contractName) return { success: false, message: `Unknown token type: ${tokenType}` }

  onStatus('Submitting to Blockscout for verification…')

  const BLOCKSCOUT_API = 'https://robinhoodchain.blockscout.com/api'

  const body = new URLSearchParams({
    module:              'contract',
    action:              'verifysourcecode',
    contractaddress:     contractAddress,
    sourceCode:          JSON.stringify(STANDARD_INPUT),
    codeformat:          'solidity-standard-json-input',
    contractname:        contractName,
    compilerversion:     COMPILER_VERSION,
    constructorArguements: '',
    licenseType:         '3',
  })

  let guid: string
  try {
    const res  = await fetch(BLOCKSCOUT_API, { method: 'POST', body })
    const json = await res.json()

    if (json.status !== '1') {
      if (json.result?.toLowerCase().includes('already verified') ||
          json.message?.toLowerCase().includes('already verified')) {
        return { success: true, message: 'Already verified on Blockscout.' }
      }
      return { success: false, message: `Blockscout submission failed: ${json.result ?? json.message}` }
    }
    guid = json.result as string
  } catch (e: any) {
    return { success: false, message: `Network error submitting to Blockscout: ${e.message}` }
  }

  onStatus('Waiting for Blockscout verification result…')
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(5000)
    try {
      const poll = await fetch(`${BLOCKSCOUT_API}?module=contract&action=checkverifystatus&guid=${guid}`)
      const pj   = await poll.json()
      const result = pj.result ?? ''
      if (result === 'Pass - Verified') return { success: true, message: 'Verified on Blockscout ✓' }
      if (result.startsWith('Fail')) return { success: false, message: `Blockscout: ${result}` }
      if (result.toLowerCase().includes('already verified')) return { success: true, message: 'Already verified on Blockscout.' }
      onStatus(`Blockscout pending… (${result || 'checking'})`)
    } catch {
      // transient
    }
  }
  return { success: false, message: 'Blockscout verification timed out. Check robinhoodchain.blockscout.com manually.' }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
