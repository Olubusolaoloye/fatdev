#!/usr/bin/env node
/**
 * Compiles FatPresale.sol → outputs bytecode to stdout
 * Usage: node scripts/compile-presale.cjs
 */
const solc = require('solc')
const fs   = require('fs')
const path = require('path')

const src = fs.readFileSync(
  path.join(__dirname, '../src/contracts/FatPresale.sol'),
  'utf8'
)

const input = {
  language: 'Solidity',
  sources: { 'FatPresale.sol': { content: src } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['evm.bytecode.object', 'abi'] } },
  },
}

const out = JSON.parse(solc.compile(JSON.stringify(input)))

if (out.errors) {
  const fatal = out.errors.filter(e => e.severity === 'error')
  if (fatal.length) {
    fatal.forEach(e => console.error(e.formattedMessage))
    process.exit(1)
  }
}

const contract = out.contracts['FatPresale.sol']['FatPresale']
const bytecode = '0x' + contract.evm.bytecode.object
const abi      = JSON.stringify(contract.abi)

console.log('BYTECODE_START')
console.log(bytecode)
console.log('BYTECODE_END')
console.log('ABI_START')
console.log(abi)
console.log('ABI_END')
console.log(`\nBytecode length: ${bytecode.length} chars`)
