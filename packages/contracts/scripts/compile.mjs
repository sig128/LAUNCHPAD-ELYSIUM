// Compiles contracts with solc 0.8.26 (solc-js from npm) and writes ABI + bytecode to out/.
// Foundry's native solc download is not reachable in every environment; this keeps builds reproducible
// with only npm. The PoolManager used in tests is Uniswap's own published artifact, not recompiled.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const solc = require('solc');
const root = path.resolve(import.meta.dirname, '..');
const nm = path.resolve(root, '../../node_modules');

const remaps = [
  ['@uniswap/v4-core/', path.join(nm, '@uniswap/v4-core/')],
  ['@uniswap/v4-periphery/', path.join(nm, '@uniswap/v4-periphery/')],
  ['@openzeppelin/contracts/', path.join(nm, '@openzeppelin/contracts/')],
  ['solmate/', path.join(nm, '@uniswap/v4-core/lib/solmate/')],
];

function listSol(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.sol')).map((f) => path.join(dir, f)) : [];
}

const files = [...listSol(path.join(root, 'src')), ...listSol(path.join(root, 'test/helpers'))];
const sources = Object.fromEntries(files.map((f) => [path.relative(root, f), { content: fs.readFileSync(f, 'utf8') }]));

function findImports(p) {
  for (const [prefix, dir] of remaps) {
    if (p.startsWith(prefix)) {
      const full = path.join(dir, p.slice(prefix.length));
      if (fs.existsSync(full)) return { contents: fs.readFileSync(full, 'utf8') };
    }
  }
  const local = path.join(root, p);
  if (fs.existsSync(local)) return { contents: fs.readFileSync(local, 'utf8') };
  return { error: `File not found: ${p}` };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    evmVersion: 'cancun',
    viaIR: process.env.VIA_IR === '1',
    optimizer: { enabled: true, runs: 800 },
    metadata: { bytecodeHash: 'none' },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};

const started = Date.now();
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
let failed = false;
for (const e of output.errors ?? []) {
  if (e.severity === 'error') failed = true;
  if (e.severity === 'error' || !/SPDX|unreachable/i.test(e.message)) console.error(e.formattedMessage ?? e.message);
}
if (failed) process.exit(1);

const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });
const sizes = [];
for (const [file, contracts] of Object.entries(output.contracts)) {
  if (!file.startsWith('src/') && !file.startsWith('test/')) continue;
  for (const [name, c] of Object.entries(contracts)) {
    const artifact = { contractName: name, sourceName: file, abi: c.abi, bytecode: `0x${c.evm.bytecode.object}`, deployedBytecode: `0x${c.evm.deployedBytecode.object}` };
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(artifact, null, 2));
    if (file.startsWith('src/')) sizes.push(`${name} ${c.evm.deployedBytecode.object.length / 2} bytes`);
  }
}
console.log(`compiled with solc ${solc.version()} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(sizes.join('\n'));
