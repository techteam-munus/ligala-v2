// k6 load test for the public lawyer directory.
//
// Models the read-heavy traffic shape we expect at 100k users:
//   - 1 search request → 1 detail-page click is the dominant pattern
//   - 80/20 split of api/directory hits vs SSR /lawyers/[slug]
//   - filter combinations (probono, chapterId, city, q) all share the
//     same backend path so we mix them to keep query-plan diversity
//
// Run:
//   k6 run tests/load/lawyers-search.js
//
// Or against a remote env:
//   k6 run -e BASE_URL=https://dev.ligala.ph -e API_URL=https://api.dev.ligala.ph \
//     tests/load/lawyers-search.js

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_URL = __ENV.API_URL || "http://localhost:8787";

export const options = {
  // 50 → 200 VU ramp simulates Manila peak (lunch hour) on a 100k-user shape.
  // 4-minute soak at peak surfaces connection-pool exhaustion + ORM N+1s that
  // a smoke test would miss.
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "2m", target: 200 },
    { duration: "1m", target: 200 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],            // < 1% errors
    http_req_duration: ["p(95)<500", "p(99)<1500"],
    "directory_api_latency": ["p(95)<300"],    // API call should be faster than SSR
    "directory_ssr_latency": ["p(95)<800"],    // full Next render incl. CSS/JS
  },
};

const apiLatency = new Trend("directory_api_latency", true);
const ssrLatency = new Trend("directory_ssr_latency", true);
const errorRate = new Rate("logical_errors");

const FILTERS = [
  "",
  "?probono=true",
  "?practiceAreaId=corporate",
  "?practiceAreaId=labor&probono=true",
  "?chapterId=manila",
  "?city=Manila",
  "?q=tax",
  "?page=2",
];

export default function () {
  group("directory api search", () => {
    const filter = FILTERS[Math.floor(Math.random() * FILTERS.length)];
    const res = http.get(`${API_URL}/directory/lawyers${filter}`, {
      tags: { name: "GET /directory/lawyers" },
    });
    apiLatency.add(res.timings.duration);
    const ok = check(res, {
      "200": (r) => r.status === 200,
      "json body": (r) => r.headers["Content-Type"]?.includes("application/json"),
    });
    if (!ok) errorRate.add(1);
  });

  group("ssr directory list", () => {
    const res = http.get(`${BASE_URL}/lawyers`, { tags: { name: "GET /lawyers (ssr)" } });
    ssrLatency.add(res.timings.duration);
    check(res, { "200": (r) => r.status === 200 });
  });

  // 1 in 5 sessions clicks through to a detail page (matches v1 conversion shape).
  if (Math.random() < 0.2) {
    group("ssr detail page", () => {
      const res = http.get(`${BASE_URL}/lawyers/atty-sample`, {
        tags: { name: "GET /lawyers/[slug] (ssr)" },
      });
      ssrLatency.add(res.timings.duration);
      check(res, { "200 or 404": (r) => r.status === 200 || r.status === 404 });
    });
  }

  sleep(Math.random() * 2 + 1);
}
