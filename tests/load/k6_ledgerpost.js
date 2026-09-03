// tests/load/k6_ledgerpost.js — k6 load test cho RPC ledgerPost (GĐ1/GĐ4).
// Chạy: k6 run tests/load/k6_ledgerpost.js
// Yêu cầu: web server đang chạy tại BASE_URL (mặc định http://localhost:3000),
// user có quyền ke_toan.tao (role ketoan/giamdoc/quanly/admin), session cookie hợp lệ.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp-up
    { duration: '1m', target: 50 },    // steady load
    { duration: '30s', target: 100 },  // spike
    { duration: '30s', target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],      // 95% request < 500ms
    http_req_failed: ['rate<0.01'],        // error rate < 1%
    'checks{type:success}': ['rate>0.99'], // 99% checks pass
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SESSION_COOKIE = __ENV.SESSION_COOKIE || ''; // set qua env: SESSION_COOKIE="session=..."

const errorRate = new Rate('errors');

function makePayload(i) {
  const now = new Date();
  const d = now.toISOString().split('T')[0];
  return {
    fn: 'ledgerPost',
    args: {
      so_ct: `CT-LT-${i}-${Date.now()}`,
      ngay: d,
      loai_ct: 'test_load',
      entries: [
        { tai_khoan: '152', du_no: Math.floor(Math.random() * 1000) + 100 },
        { tai_khoan: '331', du_co: Math.floor(Math.random() * 1000) + 100 },
      ],
    },
  };
}

export default function () {
  const url = `${BASE_URL}/api/rpc`;
  const payload = JSON.stringify(makePayload(__VU * 1000 + __ITER));
  const params = {
    headers: { 'Content-Type': 'application/json' },
    cookies: SESSION_COOKIE ? { session: SESSION_COOKIE.split('=')[1] } : {},
  };

  const res = http.post(url, payload, params);

  const success = check(res, {
    'status 200': (r) => r.status === 200,
    'ok true': (r) => {
      try { return JSON.parse(r.body).ok === true; } catch { return false; }
    },
  });

  errorRate.add(!success);
  sleep(0.1); // think time
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, { indent = '', enableColors = false }) {
  const { metrics, root_group } = data;
  const lines = [];
  lines.push(`${indent}k6 Load Test Summary`);
  lines.push(`${indent}=====================`);
  lines.push(`${indent}VUs: ${root_group.iterations?.values?.count ?? 'N/A'}`);
  lines.push(`${indent}Iterations: ${metrics.iterations?.values?.count ?? 'N/A'}`);
  lines.push(`${indent}http_req_duration p(95): ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) ?? 'N/A'}ms`);
  lines.push(`${indent}http_req_failed rate: ${(metrics.http_req_failed?.values?.rate * 100 ?? 0).toFixed(2)}%`);
  const checks = metrics.checks?.values;
  if (checks) {
    lines.push(`${indent}Checks: pass=${checks.passes ?? 0}, fail=${checks.fails ?? 0}`);
  }
  return lines.join('\n');
}