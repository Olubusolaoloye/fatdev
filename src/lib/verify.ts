import SOURCE_STANDARD     from '../contracts/flat_FatStandard.sol?raw'
import SOURCE_TAX          from '../contracts/flat_FatTax.sol?raw'
import SOURCE_DEFLATIONARY from '../contracts/flat_FatDeflationary.sol?raw'
import SOURCE_REFLECTION   from '../contracts/flat_FatReflection.sol?raw'

// Etherscan API V2 — single endpoint, chainId param selects the chain
const VERIFY_API = 'https://api.etherscan.io/v2/api'
const API_KEY    = 'BHPP1DMU8YABI4Y9MV7PUGATK49IKR8D3F'

const COMPILER_VERSION = 'v0.8.20+commit.a1b79de6'

const CONTRACT_META: Record<string, { name: string; source: string }> = {
  standard:     { name: 'FatStandard',     source: SOURCE_STANDARD     },
  tax:          { name: 'FatTax',          source: SOURCE_TAX          },
  deflationary: { name: 'FatDeflationary', source: SOURCE_DEFLATIONARY },
  reflection:   { name: 'FatReflection',   source: SOURCE_REFLECTION   },
}

export async function verifyContract(
  contractAddress: string,
  tokenType: string,      // 'standard' | 'tax' | 'deflationary' | 'reflection'
  chainId: number,
  onStatus: (s: string) => void
): Promise<{ success: boolean; message: string }> {
  const meta = CONTRACT_META[tokenType]
  if (!meta) return { success: false, message: `Unknown token type: ${tokenType}` }

  onStatus('Submitting source code for verification…')

  const body = new URLSearchParams({
    apikey:              API_KEY,
    module:              'contract',
    action:              'verifysourcecode',
    contractaddress:     contractAddress,
    sourceCode:          meta.source,
    codeformat:          'solidity-single-file',
    contractname:        meta.name,
    compilerversion:     COMPILER_VERSION,
    optimizationUsed:    '1',
    runs:                '200',
    constructorArguements: '',   // two-step deploy: no constructor args
    licenseType:         '3',   // MIT
    evmversion:          'paris',
    viaIR:               'true',
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
      const json  = await poll.json()
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

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
