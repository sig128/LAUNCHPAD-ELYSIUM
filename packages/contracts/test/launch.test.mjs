// Integration tests against a real Anvil chain and Uniswap's published v4 PoolManager bytecode.
// Run: npm run test -w @canopy/contracts   (compiles first)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeDeployData,
  getContractAddress,
  http,
  keccak256,
  parseEther,
  parseEventLogs,
  toHex,
  zeroAddress,
  concatHex,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const root = path.resolve(import.meta.dirname, '..');
const nm = path.resolve(root, '../../node_modules');
const art = (name) => JSON.parse(fs.readFileSync(path.join(root, 'out', `${name}.json`), 'utf8'));
const pmArt = JSON.parse(fs.readFileSync(path.join(nm, '@uniswap/v4-core/out/PoolManager.sol/PoolManager.json'), 'utf8'));
const A = {
  PoolManager: { abi: pmArt.abi, bytecode: pmArt.bytecode.object },
  FeeVault: art('FeeVault'),
  Locker: art('SeedLiquidityLocker'),
  Factory: art('LaunchFactory'),
  Hook: art('LaunchHook'),
  Router: art('LaunchRouter'),
  Token: art('LaunchToken'),
  MockStock: art('MockStock'),
  Attacker: art('Attacker'),
};

const PORT = 8600 + Math.floor(Math.random() * 300);
const RPC = `http://127.0.0.1:${PORT}`;
// Anvil's default funded accounts come from this public test mnemonic.
const MNEMONIC = 'test test test test test test test test test test test junk';
const [deployer, creator, trader, other, treasury] = [0, 1, 2, 3, 4].map((i) => mnemonicToAccount(MNEMONIC, { addressIndex: i }));
const CREATE2_PROXY = '0x4e59b44847b379578588920ca78fbf26c0b4956c';
const HOOK_FLAGS = (1n << 13n) | (1n << 11n) | (1n << 9n) | (1n << 7n) | (1n << 6n) | (1n << 5n) | (1n << 3n) | (1n << 2n);
const ALL_HOOK_MASK = (1n << 14n) - 1n;
const E18 = 10n ** 18n;
const SUPPLY = 1_000_000_000n * E18;

let anvil;
let pub;
let testClient;
const wallets = {};
const C = {};

// Gas depends on the block timestamp (reward release, settling earned rewards), and Anvil can mine the
// transaction a second after the estimate, so send with headroom like a wallet would.
async function send(account, address, abi, functionName, args = [], value = 0n) {
  const { request } = await pub.simulateContract({ account, address, abi, functionName, args, value });
  const gas = await pub.estimateContractGas({ account, address, abi, functionName, args, value });
  const hash = await wallets[account.address].writeContract({ ...request, gas: (gas * 13n) / 10n + 50_000n });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success', `${functionName} reverted`);
  return receipt;
}

async function deploy(account, artifact, args = []) {
  const hash = await wallets[account.address].deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  assert.equal(r.status, 'success');
  return r.contractAddress;
}

const read = (address, abi, functionName, args = []) => pub.readContract({ address, abi, functionName, args });

async function reverts(fn) {
  await assert.rejects(fn);
}

async function launch({ pair = zeroAddress, fdv = 3000n * E18, buy = 0n, salt = 1n, surrender = false, from = creator }) {
  const params = { name: 'Test Market', symbol: 'TEST', pair, openingFdv: fdv, surrenderCreatorShare: surrender, salt: toHex(salt, { size: 32 }), creatorBuy: buy, minCreatorTokens: 0n };
  const r = await send(from, C.factory, A.Factory.abi, 'launch', [params], pair === zeroAddress ? buy : 0n);
  const logs = parseEventLogs({ abi: A.Factory.abi, logs: r.logs });
  const launched = logs.find((l) => l.eventName === 'Launched').args;
  const seed = logs.find((l) => l.eventName === 'SeedRange').args;
  const info = await read(C.factory, A.Factory.abi, 'launchInfo', [launched.token]);
  const [, pairIs0] = await read(C.hook, A.Hook.abi, 'pools', [launched.poolId]);
  return { token: launched.token, poolId: launched.poolId, key: info.key, creatorTokens: launched.creatorTokens, seed, pairIs0, receipt: r };
}

const ledger = async (token) => {
  const v = await read(C.vault, A.FeeVault.abi, 'ledgers', [token]);
  const k = ['pair', 'creator', 'registered', 'creatorSurrendered', 'feesTotal', 'holderFunded', 'holderPaid', 'creatorOwed', 'creatorPaid', 'reserve', 'liquidityBudget', 'protocolOwed', 'protocolPaid'];
  return Object.fromEntries(k.map((key, i) => [key, v[i]]));
};
const claimsOf = (owner, currency) => read(C.pm, A.PoolManager.abi, 'balanceOf', [owner, BigInt(currency)]);
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);

function feeFor(gross) {
  return (gross * 100n) / 10_000n;
}

before(async () => {
  const bin = fs.existsSync(path.join(nm, '.bin/anvil')) ? path.join(nm, '.bin/anvil') : path.join(nm, '@foundry-rs/anvil-linux-amd64/bin/anvil');
  anvil = spawn(bin, ['--port', String(PORT), '--hardfork', 'cancun', '--silent'], { stdio: 'ignore' });
  pub = createPublicClient({ chain: foundry, transport: http(RPC) });
  testClient = createTestClient({ chain: foundry, mode: 'anvil', transport: http(RPC) });
  for (const acct of [deployer, creator, trader, other, treasury]) {
    wallets[acct.address] = createWalletClient({ account: acct, chain: foundry, transport: http(RPC) });
  }
  for (let i = 0; i < 100; i++) {
    try {
      await pub.getChainId();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  C.pm = await deploy(deployer, A.PoolManager, [deployer.address]);
  C.vault = await deploy(deployer, A.FeeVault, [C.pm, treasury.address]);
  C.locker = await deploy(deployer, A.Locker, [C.pm]);
  C.factory = await deploy(deployer, A.Factory, [C.pm, C.vault, C.locker, deployer.address]);

  // Mine a CREATE2 salt so the hook address encodes exactly its permission flags.
  const initCode = encodeDeployData({ abi: A.Hook.abi, bytecode: A.Hook.bytecode, args: [C.pm, C.factory, C.vault, C.locker] });
  const codeHash = keccak256(initCode);
  let salt;
  for (let i = 0n; i < 2_000_000n; i++) {
    const s = toHex(i, { size: 32 });
    const addr = getContractAddress({ opcode: 'CREATE2', from: CREATE2_PROXY, salt: s, bytecodeHash: codeHash });
    if ((BigInt(addr) & ALL_HOOK_MASK) === HOOK_FLAGS) {
      salt = s;
      C.hook = addr;
      break;
    }
  }
  assert.ok(salt, 'hook salt not found');
  const hash = await wallets[deployer.address].sendTransaction({ to: CREATE2_PROXY, data: concatHex([salt, initCode]) });
  assert.equal((await pub.waitForTransactionReceipt({ hash })).status, 'success');
  assert.notEqual(await pub.getCode({ address: C.hook }), undefined);

  await send(deployer, C.factory, A.Factory.abi, 'setHook', [C.hook]);
  await send(deployer, C.vault, A.FeeVault.abi, 'initialize', [C.hook, C.factory]);
  await send(deployer, C.locker, A.Locker.abi, 'initialize', [C.factory]);
  C.router = await deploy(deployer, A.Router, [C.pm, C.hook]);
  C.stock = await deploy(deployer, A.MockStock, ['Mock NVIDIA stock token', 'NVDAm']);
  C.attacker = await deploy(other, A.Attacker, [C.pm]);
  for (const acct of [creator, trader, other]) await send(deployer, C.stock, A.MockStock.abi, 'mint', [acct.address, 1_000_000n * E18]);
});

after(() => anvil?.kill());

test('launch with native HYPE: supply sits in the locked pool, fee splits exactly', async () => {
  const L = await launch({ buy: E18, salt: 11n });
  assert.equal(L.pairIs0, true, 'native HYPE always sorts first');
  const total = await read(L.token, A.Token.abi, 'totalSupply');
  assert.equal(total, SUPPLY);
  const inPool = await read(L.token, A.Token.abi, 'balanceOf', [C.pm]);
  const dust = await read(L.token, A.Token.abi, 'balanceOf', [C.locker]);
  const mine = await read(L.token, A.Token.abi, 'balanceOf', [creator.address]);
  assert.equal(inPool + dust + mine, SUPPLY, 'supply conservation');
  assert.equal(mine, L.creatorTokens);
  assert.ok(dust < 10n ** 6n, `locker dust ${dust}`);

  const l = await ledger(L.token);
  assert.equal(l.feesTotal, feeFor(E18));
  assert.equal(l.holderFunded, 6n * 10n ** 15n);
  assert.equal(l.reserve + l.creatorOwed + l.liquidityBudget + l.protocolOwed, 4n * 10n ** 15n);
  assert.equal(await claimsOf(C.vault, 0n), l.feesTotal, 'vault holds the fee as ERC-6909 claims');

  // Opening price matches the requested FDV within one tick spacing (about 2%).
  const sqrt = Number(L.seed.sqrtPriceX96) / 2 ** 96;
  const tokensPerHype = sqrt * sqrt;
  const fdvHype = Number(SUPPLY / E18) / tokensPerHype;
  assert.ok(fdvHype <= 3000 * 1.021 && fdvHype >= 3000 / 1.021, `opening FDV ${fdvHype}`);
  C.native = L;
});

test('router buy and sell charge exactly 1% on the HYPE side', async () => {
  const L = C.native;
  const before = (await ledger(L.token)).feesTotal;
  const amountIn = 10n * E18;
  const { result: out } = await pub.simulateContract({ account: trader, address: C.router, abi: A.Router.abi, functionName: 'buy', args: [L.key, amountIn, 1n, trader.address, deadline()], value: amountIn });
  await send(trader, C.router, A.Router.abi, 'buy', [L.key, amountIn, out, trader.address, deadline()], amountIn);
  assert.equal(await read(L.token, A.Token.abi, 'balanceOf', [trader.address]), out);
  assert.equal((await ledger(L.token)).feesTotal - before, feeFor(amountIn));

  await reverts(() => send(trader, C.router, A.Router.abi, 'buy', [L.key, amountIn, out * 10n, trader.address, deadline()], amountIn));

  const sellAmt = out / 2n;
  await send(trader, L.token, A.Token.abi, 'approve', [C.router, sellAmt]);
  const r = await send(trader, C.router, A.Router.abi, 'sell', [L.key, sellAmt, 1n, trader.address, deadline()]);
  const fee = parseEventLogs({ abi: A.Hook.abi, logs: r.logs }).find((x) => x.eventName === 'FeeTaken').args;
  assert.equal(fee.isBuy, false);
  assert.equal(fee.fee, feeFor(fee.grossPairAmount));
});

test('holder rewards release over the hour and are claimed in the pair asset', async () => {
  const L = C.native;
  await testClient.increaseTime({ seconds: 1800 });
  await testClient.mine({ blocks: 1 });
  const due = await read(L.token, A.Token.abi, 'claimable', [trader.address]);
  assert.ok(due > 0n, 'trader earned rewards');
  const balBefore = await pub.getBalance({ address: other.address });
  await send(trader, C.vault, A.FeeVault.abi, 'claimHolderRewards', [L.token, other.address]);
  const got = (await pub.getBalance({ address: other.address })) - balBefore;
  assert.ok(got >= due, 'paid at least what was claimable a block earlier');
  assert.equal(await read(L.token, A.Token.abi, 'claimable', [trader.address]) < due, true);
  const l = await ledger(L.token);
  assert.equal(l.holderPaid, got);
  assert.ok(l.holderPaid <= l.holderFunded);
});

test('stock-paired launches work in both currency orderings, fees and rewards in the stock', async () => {
  await send(deployer, C.factory, A.Factory.abi, 'setPairAllowed', [C.stock, true]);
  const seen = {};
  for (let s = 100n; s < 140n && Object.keys(seen).length < 2; s++) {
    await send(creator, C.stock, A.MockStock.abi, 'approve', [C.factory, 5n * E18]);
    const L = await launch({ pair: C.stock, fdv: 40n * E18, buy: 5n * E18, salt: s });
    seen[String(L.pairIs0)] ??= L;
  }
  assert.ok(seen.true && seen.false, 'found both orderings');
  for (const L of [seen.true, seen.false]) {
    const stockId = BigInt(C.stock);
    const claimsBefore = await claimsOf(C.vault, stockId);
    await send(trader, C.stock, A.MockStock.abi, 'approve', [C.router, 2n * E18]);
    const { result: out } = await pub.simulateContract({ account: trader, address: C.router, abi: A.Router.abi, functionName: 'buy', args: [L.key, 2n * E18, 1n, trader.address, deadline()] });
    await send(trader, C.router, A.Router.abi, 'buy', [L.key, 2n * E18, out, trader.address, deadline()]);
    assert.equal((await claimsOf(C.vault, stockId)) - claimsBefore, feeFor(2n * E18), 'fee collected in the stock token');

    await send(trader, L.token, A.Token.abi, 'approve', [C.router, out / 3n]);
    await send(trader, C.router, A.Router.abi, 'sell', [L.key, out / 3n, 1n, trader.address, deadline()]);

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    const due = await read(L.token, A.Token.abi, 'claimable', [trader.address]);
    const stockBefore = await read(C.stock, A.MockStock.abi, 'balanceOf', [trader.address]);
    await send(trader, C.vault, A.FeeVault.abi, 'claimHolderRewards', [L.token, trader.address]);
    const got = (await read(C.stock, A.MockStock.abi, 'balanceOf', [trader.address])) - stockBefore;
    assert.ok(due > 0n && got >= due, `holder rewards paid in stock (${got})`);
  }
  C.stockLaunch = seen.true;
});

test('creator fees: only the creator claims; surrender sends the share to holders', async () => {
  const L = C.native;
  await reverts(() => send(other, C.vault, A.FeeVault.abi, 'claimCreatorFees', [L.token, other.address]));
  const owed = (await ledger(L.token)).creatorOwed;
  const before = await pub.getBalance({ address: other.address });
  await send(creator, C.vault, A.FeeVault.abi, 'claimCreatorFees', [L.token, other.address]);
  assert.equal((await pub.getBalance({ address: other.address })) - before, owed);

  await send(creator, C.vault, A.FeeVault.abi, 'surrenderCreatorShare', [L.token]);
  await reverts(() => send(creator, C.vault, A.FeeVault.abi, 'surrenderCreatorShare', [L.token]));
  const l0 = await ledger(L.token);
  await send(trader, C.router, A.Router.abi, 'buy', [L.key, 3n * E18, 1n, trader.address, deadline()], 3n * E18);
  const l1 = await ledger(L.token);
  const fee = feeFor(3n * E18);
  assert.equal(l1.creatorOwed, l0.creatorOwed, 'no new creator fees after surrender');
  assert.equal(l1.holderFunded - l0.holderFunded, fee - 3n * (fee / 10n), 'holders get 70% plus dust');
});

test('the hook and system contracts reject what they must', async () => {
  const L = C.native;
  // Pools with the hook cannot be created outside the factory.
  const fakeKey = { ...L.key, tickSpacing: 60 };
  await reverts(() => send(other, C.pm, A.PoolManager.abi, 'initialize', [fakeKey, 79228162514264337593543950336n]));
  // Exact-output swaps, outside liquidity adds and any removal are rejected.
  await reverts(() => send(other, C.attacker, A.Attacker.abi, 'tryExactOutput', [L.key, true, 1000n]));
  await reverts(() => send(other, C.attacker, A.Attacker.abi, 'tryAddLiquidity', [L.key, -887200, 887200]));
  const info = await read(C.factory, A.Factory.abi, 'launchInfo', [L.token]);
  await reverts(() => send(other, C.attacker, A.Attacker.abi, 'tryRemoveLiquidity', [L.key, info.tickLower, info.tickUpper]));
  // Privileged entry points.
  await reverts(() => send(other, C.vault, A.FeeVault.abi, 'recordFee', [L.token, 1n]));
  await reverts(() => send(other, L.token, A.Token.abi, 'fundRewards', [1n]));
  await reverts(() => send(other, L.token, A.Token.abi, 'consumeRewards', [other.address]));
  await reverts(() => send(other, C.locker, A.Locker.abi, 'lockSeed', [L.key, info.tickLower, info.tickUpper, 1n, L.token]));
  await reverts(() => send(other, C.factory, A.Factory.abi, 'setPairAllowed', [other.address, true]));
  await reverts(() => send(other, C.vault, A.FeeVault.abi, 'claimProtocolFees', [L.token, other.address]));
  // Disallowed pair asset.
  await reverts(() => launch({ pair: other.address, salt: 999n }));
  // The locker has no way to move liquidity or tokens out.
  const lockerFns = A.Locker.abi.filter((x) => x.type === 'function').map((x) => x.name).sort();
  assert.deepEqual(lockerFns, ['factory', 'initialize', 'lockSeed', 'poolManager', 'unlockCallback']);
});

test('pausing launches never blocks trading or claims', async () => {
  const L = C.native;
  await send(deployer, C.factory, A.Factory.abi, 'setLaunchesPaused', [true]);
  await reverts(() => launch({ salt: 77n }));
  await send(trader, C.router, A.Router.abi, 'buy', [L.key, E18, 1n, trader.address, deadline()], E18);
  await testClient.increaseTime({ seconds: 600 });
  await testClient.mine({ blocks: 1 });
  await send(trader, C.vault, A.FeeVault.abi, 'claimHolderRewards', [L.token, trader.address]);
  await send(deployer, C.factory, A.Factory.abi, 'setLaunchesPaused', [false]);
});

test('vault claims reconcile with per-launch ledgers for every pair asset', async () => {
  const tokens = [];
  const n = await read(C.factory, A.Factory.abi, 'launchCount');
  for (let i = 0n; i < n; i++) tokens.push(await read(C.factory, A.Factory.abi, 'allTokens', [i]));
  const owedBy = {};
  for (const t of tokens) {
    const l = await ledger(t);
    const key = l.pair.toLowerCase();
    owedBy[key] = (owedBy[key] ?? 0n) + l.feesTotal - l.holderPaid - l.creatorPaid - l.protocolPaid;
  }
  for (const [pair, owed] of Object.entries(owedBy)) {
    assert.equal(await claimsOf(C.vault, BigInt(pair)), owed, `claims for ${pair}`);
  }
});
