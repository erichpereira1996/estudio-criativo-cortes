'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const media = require('../src/media');

test('encaixe do preview preserva a área selecionada sem cortar as laterais', () => {
  const filtro = media.filtroDeFormato('split', {
    topo: { x: 0, y: 0, w: 1, h: 0.5 },
    baixo: { x: 0, y: 0.5, w: 1, h: 0.5 },
    proporcaoTopo: 0.3,
  });
  assert.match(filtro, /force_original_aspect_ratio=decrease/);
  assert.match(filtro, /pad=1080:576/);
  assert.match(filtro, /pad=1080:1344/);
  assert.doesNotMatch(filtro, /scale=1080:576[^;]*crop=1080:576/);
});

test('presets visuais são filtros locais e opcionais', () => {
  assert.equal(media.filtroVisual('nenhum'), null);
  assert.match(media.filtroVisual('cinematico'), /eq=contrast/);
  assert.match(media.filtroVisual('vibrante'), /saturation=1\.35/);
  assert.match(media.filtroVisual('pb'), /hue=s=0/);
});
