'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../src/api');
const { cortesPorAssunto } = require('../src/pipeline');

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

test('normaliza análise JSON do Gateway Claude', () => {
  const r = api.normalizarAnalise({ content: [{ text: '```json\n{"momentos":[{"inicio":2,"fim":12,"pontuacao":91,"motivo":"virada"}]}\n```' }] }, 30);
  assert.equal(r.momentos[0].inicio, 2);
  assert.equal(r.momentos[0].pontuacao, 91);
});

test('cortes por assunto respeitam limites semânticos e removem sobreposição', () => {
  const transcricao = { segmentos: [{ inicio: 0, fim: 30, texto: 'assunto importante com começo meio e conclusão', palavras: [
    { inicio: 1, fim: 4, texto: 'assunto' }, { inicio: 5, fim: 8, texto: 'importante' },
    { inicio: 9, fim: 13, texto: 'com' }, { inicio: 14, fim: 18, texto: 'começo' },
    { inicio: 19, fim: 23, texto: 'meio' }, { inicio: 24, fim: 28, texto: 'e conclusão' },
  ] }] };
  const cortes = cortesPorAssunto(transcricao, Array(31).fill(0.5), [
    { inicio: 0, fim: 12, pontuacao: 90 }, { inicio: 2, fim: 11, pontuacao: 80 }, { inicio: 18, fim: 29, pontuacao: 70 },
  ], { quantidade: 3, momentos: [], perfil: 'fala', sessao: 'fala' });
  assert.equal(cortes.length, 1);
  assert.equal(cortes[0].duracaoPorAssunto, true);
  assert.ok(cortes[0].duracao >= 20);
});
