// This file runs after globalSetup, tokens are available on global
const tokens = global.__TEST_TOKENS__ || {};
const db = global.__TEST_DB__;

module.exports = {
  adminToken: tokens.admin || '',
  giamdocToken: tokens.giamdoc || '',
  xuongToken: tokens.xuong || '',
  ketoanToken: tokens.ketoan || '',
  khoToken: tokens.kho || '',
  db,
};