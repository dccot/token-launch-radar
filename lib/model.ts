// Token Launch Radar — model "radar-2".
//
// One sealed DefiLlama snapshot in, one ranked board out. The board covers
// every slug on the snapshot's watchlist (the floor, never a ceiling) and adds
// an "early" set: pre-token protocols below the floor, found by the same rule
// on every run, so re-running this program on a future snapshot surfaces
// protocols that do not exist in this one yet.
//
// A protocol is pre-token when the snapshot records no token for it at all:
// no market cap, no CoinGecko id and no symbol. A protocol is rankable when
// it is pre-token and is not a derivative of a protocol that already has a
// token: not a versioned pool of another protocol, not in a wrapped / staked /
// bridged category, its name carries no whole word "wrapped", "staked" or
// "staking", and it does not begin with an exchange's name. The watchlist
// itself was built by the house with that same exclusion, so watchlist rows
// are taken as they stand; the exclusion is applied in full to the early set
// this program adds on its own.
//
// Implied value — what a token would be worth if the protocol's record stayed
// as it is. It is this entry's own claim, never a prediction that a token
// will be issued, and it uses only figures the snapshot itself carries:
//
//   implied = round( tvl_usd
//                    x category_multiple(category)
//                    x growth_multiplier
//                    x maturity_multiplier
//                    x breadth_multiplier )
//
//   category_multiple  How much of each TVL dollar a token in this line of
//                      business has historically been able to claim. Trading
//                      venues and lending markets, whose fees accrue directly
//                      to a token, sit highest; stable-asset issuers, whose
//                      TVL is mostly other people's reserves, sit lowest.
//                      The table is stated in full below and in the dashboard.
//   growth_multiplier  1 + clamp(change_7d, -60, 120)/100 x 0.5. A protocol
//                      that is still growing into its TVL is worth more than
//                      one shrinking out of it; the clamp keeps one wild week
//                      from dominating the ranking.
//   maturity_multiplier  0.65 + min(age_days, 1095)/1095 x 0.35, where age is
//                      the time since DefiLlama first tracked the protocol.
//                      Surviving three years with no token is evidence of a
//                      real product; a protocol listed last month has not
//                      yet shown that. Unknown age counts as 365 days.
//   breadth_multiplier  1 + 0.04 x min(chains - 1, 6). Each additional chain
//                      is another distribution surface a future token can be
//                      farmed on, with diminishing credit after seven chains.
//
// No protocol name is ever special-cased: one function scores every row, and
// the dashboard recomputes each row from the same constants and shows its
// work, so a reader can audit any number on the board in seconds.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  category_multiples: Record<string, number>;
  default_multiple: number;
  uncategorised_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_extra_chains: number;
}

export const MODEL: ModelConstants = {
  category_multiples: {
    'Dexs': 0.5,
    'Derivatives': 0.45,
    'Lending': 0.4,
    'CDP': 0.38,
    'CDP Manager': 0.38,
    'Launchpad': 0.4,
    'RWA': 0.35,
    'Risk Curators': 0.34,
    'Onchain Capital Allocator': 0.34,
    'Yield': 0.3,
    'Yield Aggregator': 0.3,
    'Leveraged Farming': 0.3,
    'Farm': 0.3,
    'Liquidity Manager': 0.3,
    'Basis Trading': 0.28,
    'Liquid Staking': 0.28,
    'Staking Pool': 0.28,
    'Restaking': 0.28,
    'Options': 0.32,
    'Options Vault': 0.3,
    'Synthetics': 0.32,
    'Prediction Market': 0.36,
    'Payments': 0.3,
    'Insurance': 0.3,
    'Chain': 0.42,
    'Privacy': 0.3,
    'Indexes': 0.26,
    'AI Agents': 0.3,
    'Decentralized AI': 0.3,
    'NFT Marketplace': 0.3,
    'OTC Marketplace': 0.28,
    'Uncollateralized Lending': 0.36,
    'Collateral Management': 0.3,
    'Collateral Markets': 0.3,
    'Interest Rate Derivatives': 0.32,
    'Governance Incentives': 0.24,
    'Token Locker': 0.22,
    'Crypto Card Issuer': 0.26,
    'CeDeFi': 0.26,
    'Algo-Stables': 0.2,
    'Dual-Token Stablecoin': 0.22,
    'Stablecoin Issuer': 0.18,
    'Reserve Currency': 0.2,
    'DOR': 0.26,
  },
  default_multiple: 0.28,
  uncategorised_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.65,
  maturity_range: 0.35,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_per_chain: 0.04,
  breadth_max_extra_chains: 6,
};

/** The model's version label: the dashboard names it and the board carries it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 180;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  tier: 'watchlist' | 'early';
  age_days: number | null;
  /** A one-line, purely factual summary of the row's own record, for the detail view. */
  signal: string;
  implied_value_usd: number;
  confidence: 'high' | 'medium' | 'low';
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row: the board row's figures plus its farm plan, verbatim. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  tier: 'watchlist' | 'early';
  confidence: 'high' | 'medium' | 'low';
  signal: string;
  implied_value_usd: number;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The category multiple one protocol gets: its category's table entry, or the stated fallback. */
export function categoryMultiple(category: string | null, model: ModelConstants): number {
  if (category === null) return model.uncategorised_multiple;
  return model.category_multiples[category] ?? model.default_multiple;
}

/** How much of the model's input record is actually present: the reader's honesty gauge. */
export function confidenceOf(p: SnapshotProtocol, age: number | null): 'high' | 'medium' | 'low' {
  let present = 0;
  if (age !== null) present += 1;
  if (p.change_7d !== null) present += 1;
  if (p.category !== null) present += 1;
  if (p.chains.length > 0) present += 1;
  if (present >= 4) return 'high';
  if (present >= 2) return 'medium';
  return 'low';
}

/** Every multiplier and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; categoryMult: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra_chains);
  const breadthMult = 1 + model.breadth_per_chain * extraChains;
  const categoryMult = categoryMultiple(protocol.category, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * categoryMult * growthMult * maturityMult * breadthMult));
  return { implied, categoryMult, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of a protocol that already trades. */
const DERIVATIVE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'Anchor BTC', 'Decentralized BTC', 'Stablecoin Wrapper', 'CEX']);

/** A whole word wrapped, staked or staking anywhere in the name. */
const DERIVATIVE_WORD = /\b(wrapped|staked|staking)\b/i;

/** Names that begin with an exchange's name: that exchange's own product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is a wrapped / staked / bridged derivative of one that already trades. */
export function isDerivative(p: SnapshotProtocol): boolean {
  if (p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) return true;
  if (DERIVATIVE_WORD.test(p.name)) return true;
  if (EXCHANGE_PREFIX.test(p.name)) return true;
  return false;
}

/** Whether a protocol is one the board may rank: pre-token, not a derivative, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isDerivative(p) && !VERSIONED.test(p.name);
}

/** A one-line factual signal for a row: tier, size, momentum, footprint and age, nothing inferred. */
export function signalOf(p: SnapshotProtocol, tier: 'watchlist' | 'early', age: number | null): string {
  const tierWord = tier === 'watchlist' ? 'Watchlist protocol' : 'Early protocol below the watchlist floor';
  const growth = p.change_7d === null ? 'no 7-day change reported' : `${p.change_7d >= 0 ? 'growing' : 'shrinking'} ${Math.abs(p.change_7d).toFixed(2)}% over 7 days`;
  const footprint = p.chains.length === 0 ? 'no chain recorded' : `live on ${p.chains.length} chain${p.chains.length === 1 ? '' : 's'}`;
  const ageWord = age === null ? 'listing date unreported' : `tracked for ${age} days with no token on record`;
  return `${tierWord}: ${growth}, ${footprint}, ${ageWord}.`;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked, exactly as the house drew it.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor, by TVL, capped.
  // This is the part that makes the radar dynamic — it reads the snapshot's figures, never a
  // hand-kept list, so a protocol that crosses into the data later is picked up on the next run.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const watchlist = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    tier: watchlist.has(s.p.slug) ? ('watchlist' as const) : ('early' as const),
    age_days: s.age,
    signal: signalOf(s.p, watchlist.has(s.p.slug) ? 'watchlist' : 'early', s.age),
    implied_value_usd: s.implied,
    confidence: confidenceOf(s.p, s.age),
    model: {
      category_multiple: s.categoryMult,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow a small amount against it once so both sides of the market record your wallet.`;
  if (c.includes('dex')) return `Swap $${capital} of USDC through ${name} on ${chain}, then provide the proceeds as liquidity to its main pool and keep the position open.`;
  if (c.includes('deriv') || c.includes('perpetual') || c.includes('options') || c.includes('synthetic')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade, then close it a day later so the volume is real, not wash.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in one app on the far side.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the staking receipt in the same wallet.`;
  if (c.includes('prediction')) return `Fund $${capital} and take one position in a liquid market on ${name}, holding it to settlement.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('manager')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares; vault share history is the record curators reward.`;
  if (c.includes('stable') || c.includes('reserve')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it rather than swapping straight back.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's real-world-asset yield token on ${chain} and hold it past one yield distribution.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy to expiry.`;
  if (c.includes('yield') || c.includes('farm') || c.includes('leveraged')) return `Provide $${capital} of liquidity to ${name}'s main vault on ${chain} and keep the position open; do not loop it more than once.`;
  if (c.includes('launchpad')) return `Commit $${capital} to one launch on ${name} and complete its participation steps in the same wallet.`;
  if (c.includes('payment') || c.includes('card')) return `Route one real payment of about $${capital} through ${name} and keep the account active afterwards.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second, diversifying action: breadth of use is what separates a farmer from a bot. */
function secondActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp')) return `Repay part of the borrow and borrow again once in a later week, so ${name} sees repeat credit use, not a single touch.`;
  if (c.includes('dex')) return `Make one swap in a second pair on ${name} in a later week, so your history is not a single pool.`;
  if (c.includes('chain')) return `Use two different apps deployed on ${name} in later weeks, so your activity is spread across its ecosystem.`;
  if (p.chains.length > 1) return `Repeat one small action through ${name} on ${p.chains[1]}, its second chain, so the wallet is visible on more than one network.`;
  return `Repeat the main action on ${name} once in a later week at a smaller size, so the wallet shows a pattern of use on ${chain}, not one visit.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names, and it starts with the two
 * safety steps that cost real farmers the most when skipped.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm ${p.name} with, keep its seed phrase offline, and never reuse a wallet that holds your main funds.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `Verify you are on ${p.name}'s real app before depositing: reach it from the protocol's official account or listing, check the contract address it shows, and start with a $5 test deposit.`,
      cost: 'a $5 test deposit plus about $2 of gas',
      time: '10 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, chain),
      cost: 'about $2 of gas for the repeat action',
      time: '10 minutes, in a later week',
    },
    {
      text: `Make one qualifying action each week — a deposit, a borrow, a swap, a claim or a vote — and hold the position for at least ${hold} days so the activity spans more than one snapshot.`,
      cost: 'about $2 of gas a week, with the capital left in place',
      time: `10 minutes a week for ${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points, rewards or governance page and claim only from the link it publishes there; never pay a third party to claim for you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Keep a farm log for ${p.name}: the wallet, the dates, the amounts and the transaction hashes, so you can prove the history, repeat the position, or unwind it cleanly.`,
      cost: 'nothing but the log itself',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, set aside from the ranking: the market's own values, by market cap. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js: same figures, plus the farm plan board.json carries. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    tier: row.tier,
    confidence: row.confidence,
    signal: row.signal,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => r.tier === 'early').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, spread, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board has ${board.length} rows: the gate wants at least 100`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
