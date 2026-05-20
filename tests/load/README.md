# Load tests

[k6](https://k6.io) scripts that model the read-heavy traffic shape Ligala
expects at the 100k-user target.

## Install k6

```sh
winget install k6.k6                 # Windows
brew install k6                      # macOS
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6   # Debian/Ubuntu
```

## Run

The local stack needs to be up (`docker compose up -d` + `pnpm dev`):

```sh
k6 run tests/load/api-health.js
k6 run tests/load/lawyers-search.js
```

Against a deployed env:

```sh
k6 run -e BASE_URL=https://dev.ligala.ph \
       -e API_URL=https://api.dev.ligala.ph \
       tests/load/lawyers-search.js
```

## What's tested

- **`api-health.js`** — 50 VUs / 1 min against `/health`. Establishes the
  floor latency of the API Gateway → Lambda return path. Anything above
  ~150ms p95 here means the runtime itself (cold starts, init) is the
  bottleneck, not the application.
- **`lawyers-search.js`** — 50 → 200 VU ramp with a 4-minute soak at peak,
  mixing 8 filter combinations against `/directory/lawyers` plus SSR hits to
  `/lawyers` and (1-in-5) `/lawyers/[slug]`. This is the dominant traffic
  pattern for the public marketplace; thresholds enforce p95 < 500ms on the
  API call and p95 < 800ms on the full Next render.

## Thresholds and the 100k-user target

The 200-VU peak is calibrated for a 100k-user shape where:
- ~5% are active in any given hour
- Manila lunch hour and 8pm are the two daily peaks
- Each active user makes ~2 directory requests in a session
- Result: ~3 req/sec sustained, ~10 req/sec peak — 200 VUs at 1 req/2s gives
  us a generous headroom for tail latency

When the load test runs against the dev environment behind the real RDS
Proxy + Aurora, p95 numbers will be ~2–3x higher than localhost because of
network RTT — adjust thresholds before flagging a regression.

## What's NOT tested here

- Auth'd flows (case creation, invoice payment) — these are 10x more
  expensive per request and saturate the connection pool first. Add a
  scenario for them only after the read-path numbers are clean.
- Webhook processing — that's SQS-bounded throughput, not user-facing
  latency; measure it via CloudWatch queue-depth + worker duration metrics
  during a billing surge test.
