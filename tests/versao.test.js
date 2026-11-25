'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const { version, rotulo } = require('../src/versao');
test('rótulo mantém os três números da versão do pacote',()=>{
  assert.equal(rotulo('1.0.0'),'v1.0.0');assert.equal(rotulo('2.0.0'),'v2.0.0');assert.equal(rotulo('1.1.2'),'v1.1.2');assert.equal(version,require('../package.json').version);
});
function preparar() {
  const raiz=fs.mkdtempSync(path.join(os.tmpdir(),'estudio-versao-'));
  for(const dir of ['scripts','src'])fs.mkdirSync(path.join(raiz,dir));
  for(const file of ['scripts/proxima-versao.js','src/versao.js'])fs.copyFileSync(path.join(__dirname,'..',file),path.join(raiz,file));
  fs.writeFileSync(path.join(raiz,'package.json'),JSON.stringify({name:'teste',version:'1.2.3'}));
  fs.writeFileSync(path.join(raiz,'package-lock.json'),JSON.stringify({version:'1.2.3',packages:{'':{version:'1.2.3'}}}));
  return raiz;
}
for(const [tipo,esperada] of [[undefined,'1.2.4'],['patch','1.2.4'],['minor','1.3.0'],['major','2.0.0']]) {
  test('lançamento '+(tipo||'padrão')+' sincroniza pacote e lock',()=>{
    const raiz=preparar();
    const args=[path.join(raiz,'scripts/proxima-versao.js'),...(tipo?[tipo]:[])];
    const out=execFileSync(process.execPath,args,{cwd:os.tmpdir(),encoding:'utf8',windowsHide:true});
    assert(out.includes('v'+esperada));
    const pacote=JSON.parse(fs.readFileSync(path.join(raiz,'package.json'))),lock=JSON.parse(fs.readFileSync(path.join(raiz,'package-lock.json')));
    assert.equal(pacote.version,esperada);assert.equal(lock.version,esperada);assert.equal(lock.packages[''].version,esperada);
  });
}
test('tipo inválido não altera a versão',()=>{
  const raiz=preparar(),pkg=path.join(raiz,'package.json'),lock=path.join(raiz,'package-lock.json');
  const antes=[fs.readFileSync(pkg),fs.readFileSync(lock)];
  const r=spawnSync(process.execPath,[path.join(raiz,'scripts/proxima-versao.js'),'invalido'],{windowsHide:true});
  assert.notEqual(r.status,0);assert.deepEqual(fs.readFileSync(pkg),antes[0]);assert.deepEqual(fs.readFileSync(lock),antes[1]);
});
