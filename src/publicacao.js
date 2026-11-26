'use strict';

// Publicação opcional em redes sociais. As contas são conectadas por OAuth;
// senhas nunca passam pelo app. Os tokens ficam no config local do usuário.
const crypto = require('crypto');
const fs = require('fs');
const pastas = require('./pastas');

const PASTA = {
  youtube: { clientId: '', clientSecret: '', refreshToken: '', accessToken: '', expiraEm: 0 },
  tiktok: { clientKey: '', clientSecret: '', refreshToken: '', accessToken: '', openId: '', expiraEm: 0 },
};
const pendentes = new Map();

function ler() {
  const salvo = pastas.lerConfig().publicacao || {};
  return {
    youtube: Object.assign({}, PASTA.youtube, salvo.youtube || {}),
    tiktok: Object.assign({}, PASTA.tiktok, salvo.tiktok || {}),
  };
}
function gravar(cfg) {
  const raiz = pastas.lerConfig();
  raiz.publicacao = cfg;
  pastas.gravarConfig(raiz);
  return resumo();
}
function salvarConfig(recebido) {
  const atual = ler();
  const entrada = recebido && typeof recebido === 'object' ? recebido : {};
  for (const plataforma of ['youtube', 'tiktok']) {
    const novo = entrada[plataforma] && typeof entrada[plataforma] === 'object' ? entrada[plataforma] : {};
    const permitido = plataforma === 'youtube' ? ['clientId', 'clientSecret'] : ['clientKey', 'clientSecret'];
    for (const chave of permitido) if (novo[chave] !== undefined && String(novo[chave] || '').trim()) atual[plataforma][chave] = String(novo[chave]).trim();
  }
  return gravar(atual);
}
function resumo() {
  const cfg = ler();
  return {
    youtube: { configurado: Boolean(cfg.youtube.clientId && cfg.youtube.clientSecret), conectado: Boolean(cfg.youtube.refreshToken), clientId: cfg.youtube.clientId || '', canal: cfg.youtube.canal || '' },
    tiktok: { configurado: Boolean(cfg.tiktok.clientKey && cfg.tiktok.clientSecret), conectado: Boolean(cfg.tiktok.refreshToken), clientKey: cfg.tiktok.clientKey || '', usuario: cfg.tiktok.usuario || '' },
  };
}
function base64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function query(obj) { return new URLSearchParams(Object.entries(obj).filter(([, v]) => v != null && v !== '')).toString(); }
function redirect(host, plataforma) { return 'http://' + host + '/api/publicacao/oauth/' + plataforma + '/callback'; }
function iniciarOAuth(plataforma, host) {
  if (!['youtube', 'tiktok'].includes(plataforma)) throw new Error('Plataforma não suportada.');
  const cfg = ler()[plataforma];
  if (plataforma === 'youtube' && !cfg.clientId) throw new Error('Informe o Client ID do YouTube nos Ajustes.');
  if (plataforma === 'tiktok' && !cfg.clientKey) throw new Error('Informe o Client Key do TikTok nos Ajustes.');
  const state = base64url(crypto.randomBytes(24));
  pendentes.set(state, { plataforma, criadoEm: Date.now(), host });
  setTimeout(() => pendentes.delete(state), 10 * 60 * 1000);
  const url = plataforma === 'youtube'
    ? 'https://accounts.google.com/o/oauth2/v2/auth?' + query({ client_id: cfg.clientId, redirect_uri: redirect(host, plataforma), response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/youtube.upload', state })
    : 'https://www.tiktok.com/v2/auth/authorize/?' + query({ client_key: cfg.clientKey, redirect_uri: redirect(host, plataforma), response_type: 'code', scope: 'user.info.basic,video.publish', state });
  return { url };
}
async function corpoUrl(url, opcoes) {
  const res = await fetch(url, opcoes);
  const texto = await res.text();
  let corpo = {}; try { corpo = texto ? JSON.parse(texto) : {}; } catch (_) { corpo = { texto }; }
  if (!res.ok) throw new Error((corpo.error_description || corpo.error?.message || corpo.message || ('Serviço respondeu HTTP ' + res.status)));
  return corpo;
}
async function callback(plataforma, codigo, state, host) {
  const p = pendentes.get(state);
  if (!p || p.plataforma !== plataforma || p.host !== host || Date.now() - p.criadoEm > 10 * 60 * 1000) throw new Error('Autorização expirada. Tente conectar novamente.');
  pendentes.delete(state);
  const cfg = ler()[plataforma];
  const dados = plataforma === 'youtube'
    ? { code: codigo, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirect(host, plataforma), grant_type: 'authorization_code' }
    : { code: codigo, client_key: cfg.clientKey, client_secret: cfg.clientSecret, redirect_uri: redirect(host, plataforma), grant_type: 'authorization_code' };
  const token = await corpoUrl(plataforma === 'youtube' ? 'https://oauth2.googleapis.com/token' : 'https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: query(dados) });
  const raiz = pastas.lerConfig();
  raiz.publicacao = ler();
  raiz.publicacao[plataforma].refreshToken = token.refresh_token || raiz.publicacao[plataforma].refreshToken;
  raiz.publicacao[plataforma].accessToken = token.access_token || '';
  raiz.publicacao[plataforma].expiraEm = Date.now() + Number(token.expires_in || 3600) * 1000;
  if (token.open_id) raiz.publicacao[plataforma].openId = token.open_id;
  pastas.gravarConfig(raiz);
  return resumo();
}
async function token(plataforma) {
  const cfg = ler()[plataforma];
  if (cfg.accessToken && Number(cfg.expiraEm) > Date.now() + 60_000) return cfg.accessToken;
  if (!cfg.refreshToken) throw new Error('Conecte sua conta ' + (plataforma === 'youtube' ? 'do YouTube' : 'do TikTok') + ' antes de publicar.');
  const dados = plataforma === 'youtube'
    ? { client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refreshToken, grant_type: 'refresh_token' }
    : { client_key: cfg.clientKey, client_secret: cfg.clientSecret, refresh_token: cfg.refreshToken, grant_type: 'refresh_token' };
  const novo = await corpoUrl(plataforma === 'youtube' ? 'https://oauth2.googleapis.com/token' : 'https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: query(dados) });
  const raiz = pastas.lerConfig(); raiz.publicacao = ler();
  raiz.publicacao[plataforma].accessToken = novo.access_token; raiz.publicacao[plataforma].expiraEm = Date.now() + Number(novo.expires_in || 3600) * 1000;
  pastas.gravarConfig(raiz);
  return novo.access_token;
}
function multipart(meta, arquivo) {
  const boundary = '----EstudioCortes' + crypto.randomBytes(12).toString('hex');
  const inicio = Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: video/mp4\r\n\r\n');
  return { body: Buffer.concat([inicio, fs.readFileSync(arquivo), Buffer.from('\r\n--' + boundary + '--\r\n')]), type: 'multipart/related; boundary=' + boundary };
}
async function youtube(arquivo, opcoes) {
  const accessToken = await token('youtube');
  const mp = multipart({ snippet: { title: opcoes.titulo || 'Novo Short', description: opcoes.descricao || '', categoryId: '22' }, status: { privacyStatus: opcoes.privacidade || 'private', selfDeclaredMadeForKids: false } }, arquivo);
  const r = await corpoUrl('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': mp.type, 'Content-Length': String(mp.body.length) }, body: mp.body });
  return { ok: true, plataforma: 'youtube', id: r.id, url: r.id ? 'https://youtu.be/' + r.id : '' };
}
async function tiktok(arquivo, opcoes) {
  const accessToken = await token('tiktok');
  const dados = fs.statSync(arquivo);
  const init = await corpoUrl('https://open.tiktokapis.com/v2/post/publish/video/init/', { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ post_info: { title: opcoes.descricao || opcoes.titulo || '', privacy_level: opcoes.privacidade === 'public' ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY', disable_duet: false, disable_comment: false, disable_stitch: false }, source_info: { source: 'FILE_UPLOAD', video_size: dados.size, chunk_size: dados.size, total_chunk_count: 1 } }) });
  const upload = init.data || {};
  if (!upload.upload_url || !upload.publish_id) throw new Error('TikTok não retornou o endereço de upload.');
  const res = await fetch(upload.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(dados.size), 'Content-Range': 'bytes 0-' + (dados.size - 1) + '/' + dados.size }, body: fs.readFileSync(arquivo) });
  if (!res.ok) throw new Error('Falha ao enviar o vídeo ao TikTok (HTTP ' + res.status + ').');
  return { ok: true, plataforma: 'tiktok', id: upload.publish_id, url: '' };
}
async function publicar(plataforma, arquivo, opcoes) {
  if (!fs.existsSync(arquivo)) throw new Error('Corte não encontrado.');
  if (plataforma === 'youtube') return youtube(arquivo, opcoes || {});
  if (plataforma === 'tiktok') return tiktok(arquivo, opcoes || {});
  throw new Error('Plataforma de publicação não suportada.');
}

module.exports = { ler, salvarConfig, resumo, iniciarOAuth, callback, publicar, redirect };
