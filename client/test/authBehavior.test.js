import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAuthFailure, authGate, classifyAuthFailure } from '../src/authBehavior.js';

function capture() {
  let tokenCleared = 0;
  let serverDown = null;
  return {
    clearToken() { tokenCleared += 1; },
    setServerDown(value) { serverDown = value; },
    get tokenCleared() { return tokenCleared; },
    get serverDown() { return serverDown; },
  };
}

test('network error on /auth/me keeps the token and marks the server down', () => {
  const spy = capture();
  const outcome = applyAuthFailure(Object.assign(new Error('fetch failed'), { status: 0 }), spy);
  assert.equal(outcome, 'server-down');
  assert.equal(spy.tokenCleared, 0, 'must not clear the saved token');
  assert.equal(spy.serverDown, true, 'must enter the reconnecting state');
});

test('5xx on /auth/me keeps the token and marks the server down', () => {
  const spy = capture();
  const outcome = applyAuthFailure(Object.assign(new Error('Service Unavailable'), { status: 503 }), spy);
  assert.equal(outcome, 'server-down');
  assert.equal(spy.tokenCleared, 0);
  assert.equal(spy.serverDown, true);
});

test('401 on /auth/me clears the token and does not show the server-down state', () => {
  const spy = capture();
  const outcome = applyAuthFailure(Object.assign(new Error('Unauthorized'), { status: 401 }), spy);
  assert.equal(outcome, 'logged-out');
  assert.equal(classifyAuthFailure({ status: 401 }), 'logged-out');
  assert.equal(spy.tokenCleared, 1);
  assert.equal(spy.serverDown, false);
});

test('RequireAuth shows the server-down message instead of redirecting to /login', () => {
  // This is the exact regression found in the browser: token present, API down.
  assert.equal(authGate({ ready: true, user: null, serverDown: true }), 'server-down');
  assert.equal(authGate({ ready: true, user: { name: 'TEST Learner' }, serverDown: true }), 'server-down');
});

test('RequireAuth redirects to login only when genuinely logged out', () => {
  assert.equal(authGate({ ready: true, user: null, serverDown: false }), 'login');
  assert.notEqual(authGate({ ready: true, user: { name: 'TEST Learner' }, serverDown: false }), 'login');
});

test('RequireAuth renders the page after the saved session is restored', () => {
  assert.equal(authGate({ ready: true, user: { name: 'TEST Learner' }, serverDown: false }), 'ready');
  assert.equal(authGate({ ready: false, user: null, serverDown: false }), 'loading');
});
