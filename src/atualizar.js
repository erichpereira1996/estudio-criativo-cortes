'use strict';
// Esta edição mantém sua identidade local; não instala pacotes do projeto original.
const { version, rotulo } = require('./versao');
function versaoLocal() { return version; }
async function checarRemoto() {
  return {
    rotulo: rotulo(), versaoAtual: version, versaoRemota: version, shaLocal: '', shaRemoto: '',
    temAtualizacao: false, obrigatoria: false, motivoAtualizacao: '',
    resumoVersao: 'Atualizações do projeto original desativadas nesta edição personalizada.',
    precisaInstalador: false, urlInstalador: '', aviso: null, offline: false,
  };
}
async function aplicarAtualizacao() {
  throw new Error('Atualizações do projeto original desativadas nesta edição personalizada.');
}
module.exports = { versaoLocal, checarRemoto, aplicarAtualizacao };
