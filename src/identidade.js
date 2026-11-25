'use strict';
// Assets imutáveis: projetos antigos continuam apontando para a mesma identidade.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const pastas = require('./pastas');
const media = require('./media');

const EXTENSOES = { vinheta: ['.mp4', '.mov', '.webm'], marca: ['.png', '.jpg', '.jpeg', '.webp'] };
const LIMITES = { vinheta: 100 * 1048576, marca: 10 * 1048576 };
const PADRAO = {
  vinheta: { ativa: false, arquivo: null, posicao: 'inicio' },
  marca: { ativa: false, arquivo: null, x: 100, y: 100, tamanho: 18, opacidade: 75, margem: 3, naVinheta: false },
};
function pasta() { return path.join(path.dirname(pastas.arquivoConfig()), 'identidade'); }
function numero(v, padrao, min, max) { return v === '' || v == null || !Number.isFinite(Number(v)) ? padrao : Math.max(min, Math.min(max, Number(v))); }
function idSeguro(id) { return typeof id === 'string' && /^[a-f0-9]{64}\.(mp4|mov|webm|png|jpg|jpeg|webp)$/.test(id) ? id : null; }
function normalizar(cfg) {
  const v = (cfg && cfg.vinheta) || {}, m = (cfg && cfg.marca) || {};
  return {
    vinheta: { ativa: v.ativa === true, arquivo: idSeguro(v.arquivo), posicao: v.posicao === 'fim' ? 'fim' : 'inicio' },
    marca: { ativa: m.ativa === true, arquivo: idSeguro(m.arquivo), x: numero(m.x, 100, 0, 100), y: numero(m.y, 100, 0, 100),
      tamanho: numero(m.tamanho, 18, 5, 45), opacidade: numero(m.opacidade, 75, 10, 100), margem: numero(m.margem, 3, 0, 10), naVinheta: m.naVinheta === true },
  };
}
function caminho(id) {
  if (!idSeguro(id)) throw new Error('Arquivo de identidade inválido.');
  return path.join(pasta(), id);
}
function asset(id) {
  if (!id) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(caminho(id) + '.json', 'utf8'));
    if (!fs.statSync(caminho(id)).isFile()) return null;
    return { id, nome: meta.nome, tipo: meta.tipo, largura: meta.largura, altura: meta.altura, duracao: meta.duracao, url: '/api/identidade/arquivo?id=' + id };
  } catch (_) { return null; }
}
function validar(cfg) {
  const r = normalizar(cfg);
  for (const tipo of ['vinheta', 'marca']) {
    if (!r[tipo].ativa) continue;
    const a = asset(r[tipo].arquivo);
    if (!a || a.tipo !== tipo) throw new Error(tipo === 'vinheta' ? 'Escolha um vídeo válido para a vinheta.' : 'Escolha uma imagem válida para a marca d’água.');
  }
  return r;
}
function ler() { return normalizar(pastas.lerConfig().identidade || PADRAO); }
function publico(cfg) {
  const r = normalizar(cfg || ler());
  return { config: r, arquivos: { vinheta: asset(r.vinheta.arquivo), marca: asset(r.marca.arquivo) } };
}
function salvar(cfg) {
  const r = validar(cfg), config = pastas.lerConfig();
  config.identidade = r;
  pastas.gravarConfig(config);
  return publico(r);
}
function presets() { return pastas.lerConfig().identidadePresets || []; }
function salvarPreset(nome, config) {
  nome = typeof nome === 'string' ? nome.trim() : '';
  if (!nome || nome.length > 80) throw new Error('Informe um nome de até 80 caracteres.');
  const r = validar(config), cfg = pastas.lerConfig(), lista = presets();
  if (lista.some(p => p.nome.toLocaleLowerCase() === nome.toLocaleLowerCase())) throw new Error('Já existe um preset com esse nome. Escolha outro nome.');
  if (lista.length >= 100) throw new Error('Limite de 100 presets atingido.');
  const preset = { id: crypto.randomUUID(), nome, config: r };
  cfg.identidadePresets = [...lista, preset]; pastas.gravarConfig(cfg);
  return preset;
}
function excluirPreset(id) {
  const cfg = pastas.lerConfig();
  cfg.identidadePresets = presets().filter(p => p.id !== id);
  pastas.gravarConfig(cfg);
}
function carregarPreset(id) {
  const p = presets().find(p => p.id === id);
  if (!p) throw new Error('Preset não encontrado.');
  return publico(validar(p.config));
}
async function receber(req, tipo, nome) {
  if (!EXTENSOES[tipo]) throw new Error('Tipo de arquivo inválido.');
  const ext = path.extname(String(nome || '')).toLowerCase();
  if (!EXTENSOES[tipo].includes(ext)) throw new Error(tipo === 'vinheta' ? 'Use MP4, MOV ou WebM.' : 'Use PNG, JPG ou WebP.');
  const limite = LIMITES[tipo];
  if (Number(req.headers['content-length']) > limite) throw new Error('Arquivo grande demais: limite de ' + limite / 1048576 + ' MB.');
  fs.mkdirSync(pasta(), { recursive: true });
  const tmp = path.join(pasta(), 'upload-' + crypto.randomUUID() + ext);
  let bytes = 0;
  const hash = crypto.createHash('sha256');
  try {
    await pipeline(req, new Transform({ transform(chunk, enc, done) {
      bytes += chunk.length;
      if (bytes > limite) return done(new Error('Arquivo excedeu o limite de tamanho.'));
      hash.update(chunk); done(null, chunk);
    } }), fs.createWriteStream(tmp));
    if (!bytes) throw new Error('O arquivo está vazio.');
    const info = await media.inspecionar(tmp);
    if (!info.temVideo || !info.largura || !info.altura || info.largura * info.altura > 40000000) throw new Error('Arquivo visual inválido ou resolução excessiva.');
    if (tipo === 'vinheta' && info.duracao < 2) throw new Error('A vinheta precisa ter pelo menos 2 segundos. Serão usados os primeiros 2 segundos.');
    if (tipo === 'marca' && !['png', 'mjpeg', 'webp'].includes(info.codecVideo)) throw new Error('A marca d’água precisa ser uma imagem PNG, JPG ou WebP.');
    const id = hash.digest('hex') + ext;
    const destino = caminho(id);
    if (!fs.existsSync(destino)) fs.renameSync(tmp, destino);
    fs.writeFileSync(destino + '.json', JSON.stringify({ tipo, nome: path.basename(String(nome)).slice(0, 180), ...info }), 'utf8');
    return asset(id);
  } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
}
function geometria(largura, altura, imagem, marca) {
  const aspecto = imagem.largura / imagem.altura;
  const w = Math.max(2, Math.round(Math.min(largura * marca.tamanho / 100, altura * 0.45 * aspecto)));
  const h = Math.max(2, Math.round(w / aspecto));
  const margem = Math.round(Math.min(largura, altura) * marca.margem / 100);
  return { w, h, x: Math.round(margem + Math.max(0, largura - w - 2 * margem) * marca.x / 100), y: Math.round(margem + Math.max(0, altura - h - 2 * margem) * marca.y / 100) };
}
/** Uma finalização sobre o conteúdo já legendado. Nunca recebe um clipe já finalizado. */
async function aplicar(video, config, qualidade, aoProgredir) {
  const cfg = validar(config);
  if (!cfg.vinheta.ativa && !cfg.marca.ativa) return { extra: 0, deslocamento: 0 };
  const { ffmpeg } = await media.garantirFfmpeg();
  const info = await media.inspecionar(video);
  const largura = Math.ceil(info.largura / 2) * 2, altura = Math.ceil(info.altura / 2) * 2;
  const fps = Math.max(1, Math.min(120, info.fps || 30));
  const dur = info.duracao, extra = cfg.vinheta.ativa ? 2 : 0;
  const args = ['-y', '-i', video], filtros = [];
  let entradaMarca = 1;
  if (cfg.vinheta.ativa) { args.push('-i', caminho(cfg.vinheta.arquivo)); entradaMarca++; }
  if (cfg.marca.ativa) args.push('-loop', '1', '-f', 'image2', '-i', caminho(cfg.marca.arquivo));
  filtros.push('[0:v]scale=' + largura + ':' + altura + ',setsar=1,fps=' + fps + ',format=yuv420p,setpts=PTS-STARTPTS[conteudo]');
  let v = '[conteudo]', a = '0:a?';
  function overlay(entrada) {
    const g = geometria(largura, altura, asset(cfg.marca.arquivo), cfg.marca);
    filtros.push('[' + entradaMarca + ':v]scale=' + g.w + ':' + g.h + ',format=rgba,colorchannelmixer=aa=' + cfg.marca.opacidade / 100 + '[logo]');
    filtros.push(entrada + '[logo]overlay=x=' + g.x + ':y=' + g.y + ':shortest=1:eof_action=repeat[marcado]');
    return '[marcado]';
  }
  if (cfg.marca.ativa && !cfg.marca.naVinheta) v = overlay(v);
  if (cfg.vinheta.ativa) {
    const intro = await media.inspecionar(caminho(cfg.vinheta.arquivo));
    filtros.push('[1:v]trim=duration=2,setpts=PTS-STARTPTS,scale=' + largura + ':' + altura + ':force_original_aspect_ratio=decrease,pad=' + largura + ':' + altura + ':(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=' + fps + ',format=yuv420p,tpad=stop_mode=clone:stop_duration=2,trim=duration=2[vinheta]');
    const audio = (entrada, tem, segundos, rotulo) => {
      filtros.push((tem ? entrada + 'aresample=48000:async=1:first_pts=0,aformat=sample_fmts=fltp:channel_layouts=stereo,apad' : 'anullsrc=r=48000:cl=stereo') + ',atrim=duration=' + segundos + ',asetpts=PTS-STARTPTS[' + rotulo + ']');
    };
    audio('[0:a]', info.temAudio, dur, 'somConteudo');
    audio('[1:a]', intro.temAudio, 2, 'somVinheta');
    const conteudo = v + '[somConteudo]', vinheta = '[vinheta][somVinheta]';
    filtros.push((cfg.vinheta.posicao === 'inicio' ? vinheta + conteudo : conteudo + vinheta) + 'concat=n=2:v=1:a=1[final][somFinal]');
    v = '[final]'; a = '[somFinal]';
  }
  if (cfg.marca.ativa && cfg.marca.naVinheta) v = overlay(v);
  const q = { rapida: ['veryfast', '23'], alta: ['medium', '18'], maxima: ['slow', '15'] }[qualidade] || ['medium', '18'];
  const tmp = path.join(path.dirname(video), '.identidade-' + crypto.randomUUID() + '.mp4');
  args.push('-filter_complex', filtros.join(';'), '-map', v, '-map', a, '-t', String(dur + extra),
    '-c:v', 'libx264', '-preset', q[0], '-crf', q[1], '-pix_fmt', 'yuv420p',
    '-c:a', cfg.vinheta.ativa ? 'aac' : 'copy', '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', '-loglevel', 'error', tmp);
  try {
    await media.rodar(ffmpeg, args, { aoProgredir: seg => aoProgredir && aoProgredir(Math.min(1, seg / (dur + extra))) });
    fs.renameSync(tmp, video);
  } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  return { extra, deslocamento: cfg.vinheta.ativa && cfg.vinheta.posicao === 'inicio' ? 2 : 0, duracaoFinal: dur + extra };
}
module.exports = { presets, salvarPreset, excluirPreset, carregarPreset, normalizar, validar, ler, publico, salvar, receber, caminho, asset, geometria, aplicar };
