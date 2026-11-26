'use strict';

// Gera o pacote pequeno usado pelo atualizador: somente código/documentação
// do app. Runtime, modelos, FFmpeg e dados do usuário ficam fora dele.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, 'instalador', 'dist', 'Estudio-Criativo-Cortes-update.zip');
fs.mkdirSync(path.dirname(destino), { recursive: true });
try { fs.unlinkSync(destino); } catch (_) {}
const itens = ['src', 'py', 'package.json'];
for (const nome of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'LEIA-ME-NOVIDADES.txt']) {
  if (fs.existsSync(path.join(raiz, nome))) itens.push(nome);
}
// tar.exe com -a cria ZIP nativo no Windows 10/11, sem dependência npm.
execFileSync('tar.exe', ['-a', '-c', '-f', destino, '-C', raiz, ...itens], { stdio: 'inherit', windowsHide: true });
const tamanho = fs.statSync(destino).size;
console.log('Pacote leve pronto: ' + destino + ' (' + Math.round(tamanho / 1024) + ' KB)');
