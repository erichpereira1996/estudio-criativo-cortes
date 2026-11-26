'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../src/api');

test('normaliza resposta verbose da API para o formato local', () => {
  const r = api.normalizarTranscricao({ language: 'pt', duration: 4, segments: [{ start: 0, end: 2, text: 'Olá mundo', words: [{ start: 0, end: 1, word: 'Olá' }, { start: 1, end: 2, word: 'mundo' }] }] }, 4, 'pt');
  assert.equal(r.idioma, 'pt');
  assert.equal(r.segmentos[0].palavras[1].texto, 'mundo');
  assert.equal(r.segmentos[0].fim, 2);
});

test('cria palavras aproximadas quando o provedor não devolve timestamps', () => {
  const r = api.normalizarTranscricao({ text: 'um dois três' }, 6, 'pt');
  assert.equal(r.segmentos.length, 1);
  assert.equal(r.segmentos[0].palavras.length, 3);
});

test('normaliza endpoint sem barras extras', () => {
  assert.equal(api.normalizarBaseUrl('https://exemplo.test/v1///'), 'https://exemplo.test/v1');
});
