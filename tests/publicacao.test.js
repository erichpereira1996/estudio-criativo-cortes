'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const publicacao = require('../src/publicacao');

test('resumo da publicação não expõe tokens', () => {
  const r = publicacao.resumo();
  assert.ok(r.youtube && r.tiktok);
  assert.equal(Object.prototype.hasOwnProperty.call(r.youtube, 'refreshToken'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(r.tiktok, 'accessToken'), false);
});

test('redirect OAuth usa callback local da plataforma', () => {
  assert.equal(publicacao.redirect('127.0.0.1:4321', 'youtube'), 'http://127.0.0.1:4321/api/publicacao/oauth/youtube/callback');
  assert.equal(publicacao.redirect('127.0.0.1:4321', 'tiktok'), 'http://127.0.0.1:4321/api/publicacao/oauth/tiktok/callback');
});
