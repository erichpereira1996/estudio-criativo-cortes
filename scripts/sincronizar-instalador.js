'use strict';

// Sincroniza o instalador publicado na Release com instalador/dist local.
// Uso: npm run sincronizar:instalador -- v1.7.2
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, 'instalador', 'dist', 'Instalar-Estudio-Criativo-Cortes.exe');
const repositorio = 'erichpereira1996/estudio-criativo-cortes';
const release = process.argv[2] || 'latest';
const api = 'https://api.github.com/repos/' + repositorio + '/releases/' + (release === 'latest' ? 'latest' : 'tags/' + encodeURIComponent(release.replace(/^v/i, 'v')));

async function baixar() {
  const info = await fetch(api, { headers: { 'User-Agent': 'Estudio-Criativo-Cortes-sync', Accept: 'application/vnd.github+json' } }).then(async (r) => {
    if (!r.ok) throw new Error('GitHub respondeu HTTP ' + r.status + '.');
    return r.json();
  });
  const asset = (info.assets || []).find((a) => a.name === 'Instalar-Estudio-Criativo-Cortes.exe' && a.browser_download_url);
  if (!asset) throw new Error('A Release não contém o instalador completo.');
  const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'Estudio-Criativo-Cortes-sync', Accept: 'application/octet-stream' } });
  if (!res.ok || !res.body) throw new Error('Não consegui baixar o instalador (HTTP ' + res.status + ').');
  const temporario = destino + '.download';
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  try { fs.rmSync(temporario, { force: true }); } catch (_) {}
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(temporario);
    Readable.fromWeb(res.body).pipe(out);
    out.on('finish', resolve); out.on('error', reject);
  });
  const tamanho = fs.statSync(temporario).size;
  if (tamanho < 10 * 1024 * 1024 || (asset.size && tamanho !== Number(asset.size))) {
    fs.rmSync(temporario, { force: true });
    throw new Error('Download inválido (' + tamanho + '/' + asset.size + ' bytes).');
  }
  const cabecalho = Buffer.alloc(2); const fd = fs.openSync(temporario, 'r'); fs.readSync(fd, cabecalho, 0, 2, 0); fs.closeSync(fd);
  if (cabecalho.toString('ascii') !== 'MZ') { fs.rmSync(temporario, { force: true }); throw new Error('O arquivo baixado não é um executável Windows.'); }
  try { fs.rmSync(destino, { force: true }); } catch (_) {}
  fs.renameSync(temporario, destino);
  console.log('Instalador local atualizado para ' + (info.tag_name || release) + ': ' + destino);
}

baixar().catch((e) => { console.error('ERRO: ' + e.message); process.exit(1); });
