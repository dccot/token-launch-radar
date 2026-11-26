# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dccot/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dccot/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar ranks every pre-token protocol in the sealed DefiLlama snapshot by implied value under one stated, auditable model (radar-2): TVL × a per-category multiple × clamped 7-day growth × maturity (time tracked with no token) × chain breadth. It covers the whole 40-protocol watchlist and adds 134 early protocols found below the $50M floor by the same rule — excluding wrapped, staked and bridged derivatives of tokens that already trade — for 174 ranked rows, each with a concrete seven-step farm plan (action, cost and time). The static dashboard works fully offline: a filterable board (search, category, chain, tier), a per-protocol detail view that recomputes its own implied value line by line, a live-token view set aside from the ranking, and a model sandbox that re-ranks the top 10 under stressed constants. Running the program on a future snapshot surfaces future protocols by rule, not by a hand-kept list.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Then open `out/dashboard/index.html` in a browser (it reads `out/data.js`; no server and no network needed). In the grader's container the snapshot is mounted at `/input/snapshot.json` and output goes to `/output` by default.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fxn8rvgw&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
