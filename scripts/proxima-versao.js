'use strict';
// Execute uma vez por lançamento: patch (padrão), minor ou major.
const fs = require('fs');
const path = require('path');
const tipo = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(tipo) || process.argv.length > 3) {
  console.error('Use: npm run version:next -- patch|minor|major');
  process.exit(1);
}
const raiz = path.join(__dirname, '..');
const pacote = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(raiz, 'package-lock.json'), 'utf8'));
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pacote.version)) {
  throw new Error('A versão atual deve usar três números: major.minor.patch.');
}
let [major, minor, patch] = pacote.version.split('.').map(Number);
if (tipo === 'major') { major++; minor = 0; patch = 0; }
else if (tipo === 'minor') { minor++; patch = 0; }
else patch++;
const proxima = [major, minor, patch].join('.');
pacote.version = proxima;
lock.version = proxima;
lock.packages[''].version = proxima;
fs.writeFileSync(path.join(raiz, 'package.json'), JSON.stringify(pacote, null, 2) + '\n');
fs.writeFileSync(path.join(raiz, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
console.log('Versão preparada: ' + require('../src/versao').rotulo(proxima) + '. Reinicie o app e gere o pacote de distribuição.');
