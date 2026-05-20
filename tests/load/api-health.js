// k6 baseline against the api health probe.
// Tells us the floor latency of the API Gateway → Lambda → return-200 path
// without DB, so we can subtract this from real-endpoint timings.
//
// Run:
//   k6 run tests/load/api-health.js

import http from "k6/http";
import { check } from "k6";

const API_URL = __ENV.API_URL || "http://localhost:8787";

export const options = {
  vus: 50,
  duration: "1m",
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<150", "p(99)<300"],
  },
};

export default function () {
  const res = http.get(`${API_URL}/health`);
  check(res, {
    "200": (r) => r.status === 200,
    "ok body": (r) => r.body?.includes("ok") || r.body?.includes("status"),
  });
}
