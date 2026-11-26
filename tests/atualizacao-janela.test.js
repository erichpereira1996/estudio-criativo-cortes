'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('atualização fecha a janela antiga antes de encerrar o servidor', () => {
  const arquivo = path.join(__dirname, '..', 'instalador', 'lancador', 'EstudioCriativoCortes.cs');
  const fonte = fs.readFileSync(arquivo, 'utf8');
  const bloco = fonte.match(/if \(codigo == "42"\)[\s\S]*?Encerrar\(true\);[\s\S]*?return;/);
  assert.ok(bloco, 'não encontrei o fluxo de encerramento da atualização');
  const fecha = bloco[0].indexOf('FecharJanelas()');
  assert.ok(fecha >= 0 && fecha < bloco[0].indexOf('Encerrar(true)'), 'a janela antiga precisa ser fechada antes do servidor sair');
});
