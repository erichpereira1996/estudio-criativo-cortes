'use strict';

// Integração opcional com APIs compatíveis com o formato OpenAI. A primeira
// versão usa a API apenas para transcrever o áudio; seleção e renderização
// continuam locais, preservando o vídeo original no computador.
const fs = require('fs');
const path = require('path');
const pastas = require('./pastas');

const PADRAO = {
  ativada: false,
  baseUrl: 'https://api.openai.com/v1',
  modeloTranscricao: 'whisper-1',
  fallbackLocal: true,
};

function normalizarBaseUrl(url) {
  return String(url || PADRAO.baseUrl).trim().replace(/\/+$/, '') || PADRAO.baseUrl;
}

function lerConfig() {
  const cfg = pastas.lerConfig().api || {};
  return Object.assign({}, PADRAO, cfg, {
    baseUrl: normalizarBaseUrl(cfg.baseUrl),
    modeloTranscricao: String(cfg.modeloTranscricao || PADRAO.modeloTranscricao).trim(),
    apiKey: typeof cfg.apiKey === 'string' ? cfg.apiKey : '',
    ativada: cfg.ativada === true,
    fallbackLocal: cfg.fallbackLocal !== false,
  });
}

function salvarConfig(novo) {
  const atual = lerConfig();
  const recebido = novo && typeof novo === 'object' ? novo : {};
  const apiKey = recebido.apiKey === '********' ? atual.apiKey : String(recebido.apiKey == null ? atual.apiKey : recebido.apiKey).trim();
  const cfg = Object.assign({}, atual, recebido, {
    baseUrl: normalizarBaseUrl(recebido.baseUrl || atual.baseUrl),
    modeloTranscricao: String(recebido.modeloTranscricao || atual.modeloTranscricao).trim(),
    apiKey,
    ativada: recebido.ativada === true,
    fallbackLocal: recebido.fallbackLocal !== false,
  });
  const raiz = pastas.lerConfig();
  raiz.api = cfg;
  pastas.gravarConfig(raiz);
  return cfg;
}

function resumo() {
  const cfg = lerConfig();
  return {
    ativada: cfg.ativada,
    baseUrl: cfg.baseUrl,
    modeloTranscricao: cfg.modeloTranscricao,
    fallbackLocal: cfg.fallbackLocal,
    temChave: Boolean(cfg.apiKey),
  };
}

function erroHttp(res, corpo) {
  let detalhe = '';
  try { detalhe = corpo && (corpo.error?.message || corpo.message || corpo.error) || ''; } catch (_) {}
  return new Error('API de transcrição respondeu ' + res.status + (detalhe ? ': ' + detalhe : '.'));
}

async function requisicao(url, opcoes, timeoutMs) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), timeoutMs || 120000);
  try {
    const res = await fetch(url, Object.assign({}, opcoes, { signal: controle.signal }));
    const texto = await res.text();
    let corpo = {};
    try { corpo = texto ? JSON.parse(texto) : {}; } catch (_) { corpo = { texto }; }
    if (!res.ok) throw erroHttp(res, corpo);
    return corpo;
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('A API demorou demais para responder.');
    throw e;
  } finally { clearTimeout(timer); }
}

function numero(v, padrao) {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

function palavrasDoSegmento(segmento) {
  const palavras = Array.isArray(segmento.words) ? segmento.words : (Array.isArray(segmento.palavras) ? segmento.palavras : []);
  return palavras.map((p) => ({
    inicio: numero(p.start ?? p.inicio, numero(segmento.start ?? segmento.inicio, 0)),
    fim: numero(p.end ?? p.fim, numero(segmento.end ?? segmento.fim, 0)),
    texto: String(p.word ?? p.texto ?? '').trim(),
    conf: numero(p.confidence ?? p.conf, 1),
  })).filter((p) => p.texto);
}

/** Converte respostas de provedores diferentes para o schema do transcritor local. */
function normalizarTranscricao(resposta, duracao, idioma) {
  const bruto = resposta && typeof resposta === 'object' ? resposta : {};
  const lista = Array.isArray(bruto.segments) ? bruto.segments : (Array.isArray(bruto.segmentos) ? bruto.segmentos : []);
  const texto = String(bruto.text || '').trim();
  const segmentos = lista.map((s) => {
    const inicio = numero(s.start ?? s.inicio, 0);
    const fim = Math.max(inicio, numero(s.end ?? s.fim, inicio));
    let palavras = palavrasDoSegmento(s);
    if (!palavras.length && s.text) {
      const partes = String(s.text).trim().split(/\s+/).filter(Boolean);
      const passo = partes.length ? (fim - inicio) / partes.length : 0;
      palavras = partes.map((t, i) => ({ inicio: inicio + i * passo, fim: i === partes.length - 1 ? fim : inicio + (i + 1) * passo, texto: t, conf: 1 }));
    }
    return { inicio, fim, texto: String(s.text ?? s.texto ?? '').trim(), palavras };
  }).filter((s) => s.texto || s.palavras.length);
  if (!segmentos.length && texto) {
    segmentos.push({ inicio: 0, fim: numero(duracao, 0), texto, palavras: texto.split(/\s+/).map((t) => ({ inicio: 0, fim: numero(duracao, 0), texto: t, conf: 1 })) });
  }
  return { idioma: bruto.language || bruto.idioma || idioma || 'pt', duracao: numero(bruto.duration ?? bruto.duracao, numero(duracao, 0)), segmentos };
}

async function testar(config) {
  const cfg = Object.assign(lerConfig(), config || {});
  if (!cfg.apiKey) throw new Error('Informe a chave da API antes de testar.');
  const corpo = await requisicao(normalizarBaseUrl(cfg.baseUrl) + '/models', {
    method: 'GET', headers: { Authorization: 'Bearer ' + cfg.apiKey, Accept: 'application/json' },
  }, 15000);
  return { ok: true, modelos: Array.isArray(corpo.data) ? corpo.data.length : null };
}

async function transcrever(audio, duracao, idioma, config, aoProgredir) {
  const cfg = Object.assign(lerConfig(), config || {});
  if (!cfg.apiKey) throw new Error('A API está selecionada, mas nenhuma chave foi configurada.');
  if (!fs.existsSync(audio)) throw new Error('Áudio não encontrado para enviar à API.');
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(audio)]), path.basename(audio));
  form.append('model', cfg.modeloTranscricao);
  form.append('response_format', 'verbose_json');
  if (idioma && idioma !== 'auto') form.append('language', idioma);
  form.append('timestamp_granularities[]', 'segment');
  form.append('timestamp_granularities[]', 'word');
  if (aoProgredir) aoProgredir(15, 'Enviando o áudio para a API...');
  const resposta = await requisicao(normalizarBaseUrl(cfg.baseUrl) + '/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + cfg.apiKey }, body: form,
  }, 20 * 60 * 1000);
  if (aoProgredir) aoProgredir(94, 'Transcrição recebida; preparando os cortes localmente...');
  return normalizarTranscricao(resposta, duracao, idioma);
}

module.exports = { PADRAO, lerConfig, salvarConfig, resumo, testar, transcrever, normalizarTranscricao, normalizarBaseUrl };
