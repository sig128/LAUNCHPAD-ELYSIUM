import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFee, feeOn } from '../src/fees.ts';
import { initialCurve, quoteBuyExactIn, quoteSellExactIn, realQuoteBalance, E18 } from '../src/curve.ts';
import { RewardLedger, RELEASE_DURATION } from '../src/rewards.ts';
import { getDemoDataset, DEMO_POOL_MANAGER } from '../src/demo.ts';
import { fmtPrice, fmtAmount, parseAmount } from '../src/format.ts';

test('fee splits always sum to the fee and dust goes to holders', () => {
  for (const fee of [0n, 1n, 7n, 9_999n, 10_001n, 123_456_789_012_345_678n]) {
    for (const surrendered of [false, true]) {
      const s = splitFee(fee, surrendered);
      assert.equal(s.holders + s.creator + s.protocol, fee);
      if (surrendered) assert.equal(s.creator, 0n);
      assert.ok(s.holders >= (fee * (surrendered ? 9_000n : 8_000n)) / 10_000n);
    }
  }
  assert.equal(feeOn(10n ** 18n), 10n ** 16n);
});

test('curve conserves inventory and charges exactly 1% on quote notional', () => {
  const c0 = initialCurve(1_000_000_000n * E18, 3_000n * E18);
  const buy = quoteBuyExactIn(c0, 10n * E18);
  assert.equal(buy.fee, 10n ** 17n);
  assert.equal(buy.next.tokenReserve + buy.tokenOut, c0.tokenReserve);
  const sell = quoteSellExactIn(buy.next, buy.tokenOut);
  assert.equal(sell.fee, sell.grossQuoteOut / 100n);
  assert.ok(sell.grossQuoteOut <= realQuoteBalance(buy.next));
  assert.ok(sell.quoteOut < 10n * E18, 'round trip loses at least the fees');
});

test('late buyer cannot claim rewards released before they held', () => {
  const L = new RewardLedger((a) => a === 'pool');
  L.transfer('pool', 'alice', 1000n * E18, 0n);
  L.fund(36n * E18, 0n);
  L.transfer('pool', 'bob', 1000n * E18, RELEASE_DURATION);
  const t = RELEASE_DURATION * 3n;
  assert.equal(L.claimable('bob', t), 0n);
  const a = L.claimable('alice', t);
  assert.ok(a <= 36n * E18 && a > 36n * E18 - 10n);
});

test('same-timestamp buy and sell earns nothing; sale keeps earned rewards', () => {
  const L = new RewardLedger((a) => a === 'pool');
  L.transfer('pool', 'alice', 500n * E18, 0n);
  L.fund(10n * E18, 0n);
  L.transfer('pool', 'flash', 10_000n * E18, 100n);
  L.transfer('flash', 'pool', 10_000n * E18, 100n);
  assert.equal(L.claimable('flash', 4_000n), 0n);
  L.transfer('alice', 'pool', 500n * E18, 1_800n);
  const kept = L.claimable('alice', 9_000n);
  assert.ok(kept > 4n * E18 && kept <= 10n * E18);
});

test('release pauses while eligible supply is zero', () => {
  const L = new RewardLedger((a) => a === 'pool');
  L.fund(3600n, 0n);
  L.transfer('pool', 'alice', 1n * E18, 7_200n);
  assert.equal(L.releasedAt(7_200n), 0n);
  assert.equal(L.claimable('alice', 7_200n + 3_600n), 3600n);
});

test('many tiny fundings stay solvent', () => {
  const L = new RewardLedger((a) => a === 'pool');
  L.transfer('pool', 'a', 3n, 0n);
  L.transfer('pool', 'b', 10n * E18, 0n);
  let funded = 0n;
  for (let i = 1n; i <= 400n; i++) {
    L.fund(i * 13n, i * 17n);
    funded += i * 13n;
    if (i % 50n === 0n) L.transfer('b', 'c', E18, i * 17n);
  }
  const t = 400n * 17n + 10_000n;
  const total = L.claimable('a', t) + L.claimable('b', t) + L.claimable('c', t);
  assert.ok(total <= L.releasedAt(t));
  assert.ok(L.releasedAt(t) <= funded);
});

test('demo fixtures reconcile', () => {
  const ds = getDemoDataset();
  assert.ok(ds.tokens.length >= 20);
  for (const t of ds.tokens) {
    let held = 0n;
    for (const b of t.ledger.balances.values()) held += b;
    assert.equal(held + t.curve.tokenReserve, t.totalSupply, `${t.symbol} supply conservation`);
    assert.equal(held, t.ledger.eligibleSupply, `${t.symbol} eligible supply`);
    const feeSum = t.trades.reduce((s, tr) => s + tr.fee, 0n);
    assert.equal(feeSum, t.fees.fee);
    assert.equal(t.fees.holders + t.fees.creator + t.fees.protocol, t.fees.fee);
    assert.equal(t.ledger.fundedTotal, t.fees.holders);
    assert.ok(t.ledger.claimedTotal <= t.ledger.releasedAt(BigInt(ds.anchor)));
    assert.ok(t.creatorClaimed <= t.fees.creator);
    assert.ok(t.ledger.balances.get(DEMO_POOL_MANAGER) === undefined);
  }
});

test('formatting', () => {
  assert.equal(fmtPrice(3_200_000_000_000n), '0.0₅32');
  assert.equal(fmtAmount(1_234_567n * E18 + 5n * 10n ** 17n, 18, 2), '1,234,567.5');
  assert.equal(parseAmount('1.5'), 15n * 10n ** 17n);
  assert.equal(parseAmount('abc'), null);
});
