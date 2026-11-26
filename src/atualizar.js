'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { version, rotulo } = require('./versao');

const REPOSITORIO = 'erichpereira1996/estudio-criativo-cortes';
const API_RELEASE = 'https://api.github.com/repos/' + REPOSITORIO + '/releases/latest';
const NOME_INSTALADOR = 'Instalar-Estudio-Criativo-Cortes.exe';
const NOME_PACOTE = 'Estudio-Criativo-Cortes-update.zip';
const INSTALADO = process.env.CORTADOR_AUTO_RESTART === '1';
const CACHE_MS = 5 * 60 * 1000;
let cache = null;

function versaoLocal() { return version; }
function semver(v) {
  const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function compararVersoes(a, b) {
  const x = semver(a), y = semver(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
function buscar(url, limite = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Estudio-Criativo-Cortes/' + version, Accept: 'application/vnd.github+json' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return buscar(res.headers.location, limite).then(resolve, reject);
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('GitHub respondeu HTTP ' + res.statusCode + '.')); }
      const partes = []; let tamanho = 0;
      res.on('data', b => { tamanho += b.length; if (tamanho <= limite) partes.push(b); });
      res.on('end', () => tamanho <= limite ? resolve(Buffer.concat(partes)) : reject(new Error('Resposta do GitHub muito grande.')));
      res.on('error', reject);
    }).on('error', reject);
  });
}
function releaseInfo(j) {
  if (!j || j.draft || j.prerelease) throw new Error('Nenhuma Release estável disponível.');
  const tag = j.tag_name || '';
  const remoto = String(j.name || tag).match(/v?\d+\.\d+\.\d+/i)?.[0] || tag;
  const asset = (j.assets || []).find(a => a.name === NOME_INSTALADOR && a.browser_download_url);
  const pacote = (j.assets || []).find(a => a.name === NOME_PACOTE && a.browser_download_url);
  return {
    versaoRemota: remoto.replace(/^v/i, ''), rotuloRemoto: rotulo(remoto.replace(/^v/i, '')),
    tag, resumoVersao: String(j.body || '').trim() || 'Nova versão disponível no GitHub.',
    urlRelease: j.html_url || 'https://github.com/' + REPOSITORIO + '/releases',
    urlInstalador: asset ? asset.browser_download_url : '',
    tamanhoInstalador: asset ? Number(asset.size || 0) : 0,
    urlPacote: pacote ? pacote.browser_download_url : '',
    tamanhoPacote: pacote ? Number(pacote.size || 0) : 0,
    publicadoEm: j.published_at || null,
  };
}
async function consultar(forcar = false) {
  if (!forcar && cache && Date.now() - cache.quando < CACHE_MS) return cache.info;
  try {
    const j = JSON.parse((await buscar(API_RELEASE)).toString('utf8'));
    const info = releaseInfo(j), cmp = compararVersoes(info.versaoRemota, version);
    const tem = cmp === 1;
    const precisa = tem && (!INSTALADO || !info.urlInstalador);
    const resultado = {
      rotulo: rotulo(), versaoAtual: version, versaoRemota: info.versaoRemota, rotuloRemoto: info.rotuloRemoto,
      shaLocal: '', shaRemoto: info.tag, temAtualizacao: tem, obrigatoria: false,
      motivoAtualizacao: tem ? 'Nova Release disponível no GitHub.' : '',
      resumoVersao: info.resumoVersao, precisaInstalador: precisa,
      urlInstalador: info.urlInstalador || info.urlRelease, urlRelease: info.urlRelease,
      tamanhoInstalador: info.tamanhoInstalador, urlPacote: info.urlPacote, tamanhoPacote: info.tamanhoPacote,
      precisaPacote: tem && !!info.urlPacote, publicadoEm: info.publicadoEm, aviso: null, offline: false,
    };
    cache = { quando: Date.now(), info: resultado };
    return resultado;
  } catch (e) {
    return { rotulo: rotulo(), versaoAtual: version, versaoRemota: version, shaLocal: '', shaRemoto: '', temAtualizacao: false, obrigatoria: false, motivoAtualizacao: '', resumoVersao: '', precisaInstalador: false, urlInstalador: '', urlPacote: '', tamanhoPacote: 0, precisaPacote: false, aviso: null, offline: true, erro: e.message };
  }
}
async function checarRemoto(forcar = false) { return consultar(forcar); }
function baixarArquivo(url, destino) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destino), request = https.get(url, { headers: { 'User-Agent': 'Estudio-Criativo-Cortes/' + version, Accept: 'application/octet-stream' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { out.close(); try { fs.unlinkSync(destino); } catch (_) {} return baixarArquivo(res.headers.location, destino).then(resolve, reject); }
      if (res.statusCode !== 200) { out.close(); try { fs.unlinkSync(destino); } catch (_) {} res.resume(); return reject(new Error('Download do instalador falhou (HTTP ' + res.statusCode + ').')); }
      let total = 0; res.on('data', b => { total += b.length; if (total > 2 * 1024 * 1024 * 1024) request.destroy(new Error('Instalador excede o limite permitido.')); });
      res.pipe(out); out.on('finish', () => out.close(resolve));
    });
    request.on('error', e => { out.destroy(); try { fs.unlinkSync(destino); } catch (_) {} reject(e); });
    out.on('error', e => { request.destroy(); reject(e); });
  });
}
function tamanhoValido(arquivo, esperado, minimo) {
  try {
    const n = fs.statSync(arquivo).size;
    return n >= (minimo || 1) && (!esperado || n === Number(esperado));
  } catch (_) { return false; }
}
async function baixarComTentativas(url, destino, esperado, minimo) {
  let ultimo;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await baixarArquivo(url, destino);
      if (tamanhoValido(destino, esperado, minimo)) return;
      ultimo = new Error('download incompleto (' + (fs.existsSync(destino) ? fs.statSync(destino).size : 0) + '/' + esperado + ' bytes)');
    } catch (e) { ultimo = e; }
    try { fs.unlinkSync(destino); } catch (_) {}
  }
  throw new Error('Não consegui baixar a atualização após 3 tentativas: ' + (ultimo ? ultimo.message : 'arquivo inválido'));
}
function caminhoLancador() {
  return path.resolve(path.dirname(process.execPath), '..', '..', 'EstudioCriativoCortes.exe');
}
function scriptPowerShellAtualizacao() {
  return "param([string]$Zip, [string]$App)\n$ErrorActionPreference = 'Stop'\nExpand-Archive -LiteralPath $Zip -DestinationPath $App -Force\n";
}
function scriptAtualizacaoLeve(zip, app, launcher, ps1) {
  const q = p => '"' + String(p).replaceAll('"', '""') + '"';
  return '@echo off\r\ntimeout /t 2 /nobreak >nul\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File ' + q(ps1) + ' ' + q(zip) + ' ' + q(app) + '\r\nif errorlevel 1 exit /b 1\r\nstart "" ' + q(launcher) + '\r\n';
}
async function aplicarAtualizacao() {
  if (!INSTALADO) throw new Error('Esta cópia foi iniciada pelo código-fonte. Baixe o instalador pela Release para atualizar.');
  const estado = await consultar(true);
  if (!estado.temAtualizacao) return { ok: true, atualizado: false, versaoAtual: version };
  if (!estado.urlInstalador && !estado.urlPacote) throw new Error('A Release não contém pacote de atualização.');
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-atualizacao-'));
  const launcher = caminhoLancador();
  if (!fs.existsSync(launcher)) throw new Error('Não encontrei o lançador instalado para reiniciar o app.');
  const cmd = path.join(pasta, 'aplicar-atualizacao.cmd');
  const esc = p => '"' + p.replaceAll('"', '""') + '"';
  if (estado.urlPacote) {
    const zip = path.join(pasta, NOME_PACOTE);
    await baixarComTentativas(estado.urlPacote, zip, estado.tamanhoPacote, 10 * 1024);
    const app = path.resolve(path.dirname(process.execPath), '..', '..', 'app');
    const ps1 = path.join(pasta, 'aplicar-atualizacao.ps1');
    fs.writeFileSync(ps1, scriptPowerShellAtualizacao(), 'utf8');
    fs.writeFileSync(cmd, scriptAtualizacaoLeve(zip, app, launcher, ps1), 'utf8');
  } else {
    const exe = path.join(pasta, NOME_INSTALADOR);
    await baixarComTentativas(estado.urlInstalador, exe, estado.tamanhoInstalador, 10 * 1024 * 1024);
    fs.writeFileSync(cmd, '@echo off\r\ntimeout /t 2 /nobreak >nul\r\nstart /wait "" ' + esc(exe) + ' /VERYSILENT /SUPPRESSMSGBOXES /NORESTART\r\nstart "" ' + esc(launcher) + '\r\n', 'utf8');
  }
  spawn('cmd.exe', ['/d', '/c', 'start', '"Atualização"', '/min', esc(cmd)], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return { ok: true, atualizado: true, versaoRemota: estado.versaoRemota, rotulo: rotulo(estado.versaoRemota) };
}
module.exports = { REPOSITORIO, versaoLocal, semver, compararVersoes, releaseInfo, checarRemoto, aplicarAtualizacao, tamanhoValido, scriptAtualizacaoLeve };
