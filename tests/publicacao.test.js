'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const publicacao = require('../src/publicacao');
const fs = require('node:fs');
const path = require('node:path');

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

test('painel de publicação não interrompe os eventos do painel de ajustes', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'index.html'), 'utf8');
  assert.match(html, /input\[type=url\][^\n]+\.campo/);
  assert.match(html, /setTimeout\(\(\) => \{\s*\$\('btnSalvarPublicacao'\)/);
});
