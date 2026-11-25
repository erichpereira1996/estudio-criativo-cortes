'use strict';
const { version } = require('../package.json');
function rotulo(versao = version) {
  return 'v' + versao;
}
module.exports = { version, rotulo };
