'use strict';

// Integração opcional com Gateways de modelos de linguagem. A transcrição e o
// processamento do vídeo ficam locais; o Gateway recebe somente o texto para
// sugerir os melhores momentos e copies.
const fs = require('fs');
const path = require('path');
const pastas = require('./pastas');

const PADRAO = {
  ativada: false,
  baseUrl: 'https://anthropicapi.online/api/public',
  modeloTranscricao: 'claude-sonnet-5',
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
  return new Error('Gateway respondeu ' + res.status + (detalhe ? ': ' + detalhe : '.'));
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
  if (!cfg.apiKey) throw new Error('Informe a chave do Gateway antes de testar.');
  const base = normalizarBaseUrl(cfg.baseUrl);
  let ultimo;
  for (const alvo of [base + '/v1/models', base + '/models', base]) {
    try {
      const corpo = await requisicao(alvo, { method: 'GET', headers: { Authorization: 'Bearer ' + cfg.apiKey, 'x-api-key': cfg.apiKey, Accept: 'application/json' } }, 15000);
      return { ok: true, modelos: Array.isArray(corpo.data) ? corpo.data.length : null };
    } catch (e) { ultimo = e; }
  }
  throw ultimo || new Error('Não consegui conectar ao Gateway.');
}

function textoDaTranscricao(transcricao, limite = 70000) {
  const partes = [];
  for (const s of (transcricao && transcricao.segmentos) || []) {
    const t = String(s.texto || (s.palavras || []).map((p) => p.texto).join(' ') || '').trim();
    if (t) partes.push('[' + Number(s.inicio || 0).toFixed(2) + '–' + Number(s.fim || 0).toFixed(2) + '] ' + t);
  }
  return partes.join('\n').slice(0, limite);
}

function textoDaResposta(resposta) {
  if (resposta && Array.isArray(resposta.content)) return resposta.content.map((p) => p && p.text || '').join('\n');
  if (resposta && resposta.choices && resposta.choices[0]) {
    const c = resposta.choices[0].message && resposta.choices[0].message.content;
    return Array.isArray(c) ? c.map((p) => p && p.text || '').join('\n') : String(c || '');
  }
  return String(resposta && (resposta.text || resposta.output_text) || '');
}

function normalizarAnalise(resposta, duracao) {
  let texto = textoDaResposta(resposta).trim();
  const bloco = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloco) texto = bloco[1].trim();
  const inicio = texto.indexOf('{'), fim = texto.lastIndexOf('}');
  let obj = {};
  try { obj = JSON.parse(inicio >= 0 && fim > inicio ? texto.slice(inicio, fim + 1) : texto); } catch (_) {}
  const momentos = Array.isArray(obj.momentos) ? obj.momentos : (Array.isArray(obj.moments) ? obj.moments : []);
  return {
    resumo: String(obj.resumo || obj.summary || '').slice(0, 500),
    momentos: momentos.map((m) => ({
      inicio: Math.max(0, numero(m.inicio ?? m.start, 0)),
      fim: Math.min(numero(duracao, Infinity), Math.max(0, numero(m.fim ?? m.end, 0))),
      pontuacao: Math.max(0, Math.min(100, numero(m.pontuacao ?? m.score, 0))),
      motivo: String(m.motivo || m.reason || '').slice(0, 240),
    })).filter((m) => m.fim > m.inicio),
    titulos: Array.isArray(obj.titulos) ? obj.titulos.map((t) => String(t).slice(0, 120)).filter(Boolean).slice(0, 10) : [],
  };
}

async function analisar(transcricao, duracao, config, aoProgredir) {
  const cfg = Object.assign(lerConfig(), config || {});
  if (!cfg.apiKey) throw new Error('O modo API está selecionado, mas nenhuma chave foi configurada.');
  const entrada = textoDaTranscricao(transcricao);
  if (!entrada) throw new Error('A transcrição local não trouxe texto para analisar.');
  const prompt = [
    'Analise a transcrição abaixo para criar cortes curtos de vídeo.',
    'Responda SOMENTE JSON válido, sem markdown, neste formato:',
    '{"resumo":"...","momentos":[{"inicio":0,"fim":10,"pontuacao":0,"motivo":"..."}],"titulos":["..."]}',
    'Escolha até 12 momentos com começo e fim em segundos, priorizando gancho, virada, emoção, surpresa e conclusão. Não invente tempos fora da transcrição.',
    'Duração total: ' + Number(duracao || 0).toFixed(2) + ' segundos.',
    'TRANSCRIÇÃO:\n' + entrada,
  ].join('\n');
  if (aoProgredir) aoProgredir(72, 'Enviando a transcrição para o Gateway...');
  const headers = { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' };
  const corpoClaude = { model: cfg.modeloTranscricao, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] };
  let resposta;
  try {
    resposta = await requisicao(normalizarBaseUrl(cfg.baseUrl) + '/v1/messages', { method: 'POST', headers, body: JSON.stringify(corpoClaude) }, 120000);
  } catch (e) {
    // Alguns Gateways expõem o mesmo modelo no formato OpenAI-compatible.
    resposta = await requisicao(normalizarBaseUrl(cfg.baseUrl) + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ model: cfg.modeloTranscricao, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] }) }, 120000);
  }
  if (aoProgredir) aoProgredir(94, 'Análise recebida; escolhendo os cortes localmente...');
  return normalizarAnalise(resposta, duracao);
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

module.exports = { PADRAO, lerConfig, salvarConfig, resumo, testar, transcrever, analisar, textoDaTranscricao, normalizarAnalise, normalizarTranscricao, normalizarBaseUrl };
