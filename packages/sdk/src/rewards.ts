/**
 * Reference implementation of holder-reward accounting (spec for LaunchToken.sol).
 *
 * - Every funding amount is merged with the still-unreleased balance and released linearly over
 *   RELEASE_DURATION seconds from the funding time. Rule as implemented: "each funding restarts a
 *   one-hour release of everything not yet released". These are not independent one-hour streams.
 * - While no eligible balance exists the release pauses; the remaining duration is preserved and
 *   resumes when the next eligible balance appears. Nothing is released to nobody.
 * - Cumulative index: index += rate * dt * 1e18 / eligibleSupply   (rate is wei/s scaled by 1e18,
 *   so index carries 1e36 precision per raw token unit). All divisions floor, so the sum of claims
 *   can never exceed the amount released (solvency); the remainder is rounding dust left in the vault.
 * - Before any balance change: earned += balance * (index - paid) / 1e36; paid = index. O(1).
 * - Excluded balances (pool inventory, locker, vault, sinks, burn address) do not count toward
 *   eligibleSupply and accrue nothing. Contracts and smart wallets are eligible like any address.
 * - Earned rewards stay claimable after a sale; a buyer never inherits rewards released before
 *   they held a balance; same-timestamp buy-and-sell earns zero.
 */
export const RELEASE_DURATION = 3600n;
export const INDEX_SCALE = 10n ** 36n;
export const RATE_SCALE = 10n ** 18n;

export class RewardLedger {
  rate = 0n;
  periodFinish = 0n;
  lastUpdate = 0n;
  index = 0n;
  rateDust = 0n;
  eligibleSupply = 0n;
  fundedTotal = 0n;
  releasedScaled = 0n;
  claimedTotal = 0n;
  readonly balances = new Map<string, bigint>();
  readonly paid = new Map<string, bigint>();
  readonly earned = new Map<string, bigint>();
  readonly claimedBy = new Map<string, bigint>();
  private readonly isExcluded: (account: string) => boolean;

  constructor(isExcluded: (account: string) => boolean) {
    this.isExcluded = isExcluded;
  }

  private updateGlobal(now: bigint) {
    const t = now < this.periodFinish ? now : this.periodFinish;
    if (t > this.lastUpdate) {
      if (this.eligibleSupply === 0n) {
        this.periodFinish = now + (this.periodFinish - this.lastUpdate);
      } else {
        const releasedScaled = this.rate * (t - this.lastUpdate);
        this.index += (releasedScaled * RATE_SCALE) / this.eligibleSupply;
        this.releasedScaled += releasedScaled;
      }
    }
    this.lastUpdate = now;
  }

  private settle(account: string) {
    const bal = this.balances.get(account) ?? 0n;
    const paid = this.paid.get(account) ?? 0n;
    if (bal > 0n && this.index > paid) {
      this.earned.set(account, (this.earned.get(account) ?? 0n) + (bal * (this.index - paid)) / INDEX_SCALE);
    }
    this.paid.set(account, this.index);
  }

  fund(amount: bigint, now: bigint) {
    if (amount < 0n) throw new RangeError('negative funding');
    this.updateGlobal(now);
    const leftover = now < this.periodFinish ? this.rate * (this.periodFinish - now) : 0n;
    const total = amount * RATE_SCALE + leftover + this.rateDust;
    this.rate = total / RELEASE_DURATION;
    this.rateDust = total % RELEASE_DURATION;
    this.periodFinish = now + RELEASE_DURATION;
    this.lastUpdate = now;
    this.fundedTotal += amount;
  }

  /** Mirrors ERC20._update(from, to, value). Use '' for mint (from) or burn (to). */
  transfer(from: string, to: string, value: bigint, now: bigint) {
    this.updateGlobal(now);
    const fromEligible = from !== '' && !this.isExcluded(from);
    const toEligible = to !== '' && !this.isExcluded(to);
    if (fromEligible) {
      this.settle(from);
      const bal = this.balances.get(from) ?? 0n;
      if (bal < value) throw new RangeError('insufficient balance');
      this.balances.set(from, bal - value);
    }
    if (toEligible) {
      this.settle(to);
      this.balances.set(to, (this.balances.get(to) ?? 0n) + value);
    }
    if (fromEligible && !toEligible) this.eligibleSupply -= value;
    if (!fromEligible && toEligible) this.eligibleSupply += value;
  }

  claimable(account: string, now: bigint): bigint {
    const t = now < this.periodFinish ? now : this.periodFinish;
    let index = this.index;
    if (t > this.lastUpdate && this.eligibleSupply > 0n) {
      index += (this.rate * (t - this.lastUpdate) * RATE_SCALE) / this.eligibleSupply;
    }
    const bal = this.balances.get(account) ?? 0n;
    const paid = this.paid.get(account) ?? 0n;
    return (this.earned.get(account) ?? 0n) + (bal * (index - paid)) / INDEX_SCALE;
  }

  claim(account: string, now: bigint): bigint {
    this.updateGlobal(now);
    if (!this.isExcluded(account)) this.settle(account);
    const amount = this.earned.get(account) ?? 0n;
    this.earned.set(account, 0n);
    this.claimedTotal += amount;
    this.claimedBy.set(account, (this.claimedBy.get(account) ?? 0n) + amount);
    return amount;
  }

  /** Released so far in wei, as of `now`, without mutating state. */
  releasedAt(now: bigint): bigint {
    const t = now < this.periodFinish ? now : this.periodFinish;
    let scaled = this.releasedScaled;
    if (t > this.lastUpdate && this.eligibleSupply > 0n) scaled += this.rate * (t - this.lastUpdate);
    return scaled / RATE_SCALE;
  }

  pendingReleaseAt(now: bigint): bigint {
    return this.fundedTotal - this.releasedAt(now);
  }
}
