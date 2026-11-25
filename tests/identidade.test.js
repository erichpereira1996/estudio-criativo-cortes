'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const { Readable } = require('stream');
const { execFileSync } = require('child_process');
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-identidade-'));
process.env.LOCALAPPDATA = raiz;
process.env.DADOS = raiz;
const media = require('../src/media');
const identidade = require('../src/identidade');
const legenda = require('../src/legenda');
const pastas = require('../src/pastas');
let ffmpeg, ffprobe, intro, logo, semSom;
function ff(args) { execFileSync(ffmpeg, ['-y','-hide_banner','-loglevel','error',...args], { windowsHide:true, timeout:60000, stdio:['ignore','pipe','pipe'] }); }
async function upload(tipo, arquivo) { const r = Readable.from(fs.readFileSync(arquivo)); r.headers = {}; return identidade.receber(r,tipo,path.basename(arquivo)); }
function cfg(posicao, marca = false, naVinheta = false) { return identidade.normalizar({vinheta:{ativa:!!posicao,arquivo:intro.id,posicao},marca:{ativa:marca,arquivo:logo.id,x:100,y:100,tamanho:20,opacidade:100,margem:0,naVinheta}}); }
function cor(video, segundo, x, y) { const b=execFileSync(ffmpeg,['-v','error','-ss',String(segundo),'-i',video,'-vf',`crop=2:2:${x}:${y},format=rgb24`,'-frames:v','1','-f','rawvideo','pipe:1'],{windowsHide:true,timeout:30000});return [...b.subarray(0,3)]; }
before(async()=>{
  ({ffmpeg,ffprobe}=await media.garantirFfmpeg());
  pastas.gravarConfig({desempenho:'leve',placaVideo:false});
  ff(['-f','lavfi','-i','color=blue:s=320x180:r=30:d=3','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3','-c:v','libx264','-preset','ultrafast','-c:a','aac','-shortest',path.join(raiz,'conteudo.mp4')]);
  ff(['-f','lavfi','-i','color=red:s=180x320:r=24:d=2.5','-c:v','libx264','-preset','ultrafast',path.join(raiz,'intro.mp4')]);
  ff(['-f','lavfi','-i','color=lime:s=64x32','-frames:v','1',path.join(raiz,'logo.png')]);
  ff(['-f','lavfi','-i','color=blue:s=320x180:r=30:d=3','-c:v','libx264','-preset','ultrafast',path.join(raiz,'silencioso.mp4')]);
  intro=await upload('vinheta',path.join(raiz,'intro.mp4'));logo=await upload('marca',path.join(raiz,'logo.png'));semSom=path.join(raiz,'silencioso.mp4');
});
test('configuração é validada e persiste com arquivos imutáveis',()=>{
  const c=cfg('inicio',true);identidade.salvar(c);assert.deepEqual(identidade.ler(),c);assert.equal(identidade.publico().arquivos.marca.nome,'logo.png');
  assert.throws(()=>identidade.caminho('../segredo'));
  assert.throws(()=>identidade.validar({marca:{ativa:true,arquivo:null}}),/imagem/);
  assert.equal(identidade.normalizar({marca:{x:999,opacidade:-1}}).marca.x,100);
});
test('identidade desligada não reencoda nem altera o vídeo',async()=>{
  const video=path.join(raiz,'conteudo.mp4'),antes=fs.readFileSync(video);
  assert.deepEqual(await identidade.aplicar(video,{},'rapida'),{extra:0,deslocamento:0});assert.deepEqual(fs.readFileSync(video),antes);
});
test('vinheta no início soma 2s, mantém áudio e enquadra sem distorcer',async()=>{
  const video=path.join(raiz,'inicio.mp4');fs.copyFileSync(path.join(raiz,'conteudo.mp4'),video);
  const r=await identidade.aplicar(video,cfg('inicio'),'rapida');const info=await media.inspecionar(video);
  assert.equal(r.deslocamento,2);assert(Math.abs(info.duracao-5)<.12);assert(info.temAudio);assert.equal(info.largura,320);assert.equal(info.altura,180);
  assert(cor(video,1,160,90)[0]>200);assert(cor(video,2.5,160,90)[2]>200);
  assert(cor(video,1,4,90).every(c=>c<25));
});
test('marca no conteúdo não vaza para vinheta; opacidade e posição funcionam',async()=>{
  const video=path.join(raiz,'marca.mp4');fs.copyFileSync(path.join(raiz,'conteudo.mp4'),video);
  await identidade.aplicar(video,cfg('inicio',true),'rapida');
  assert(cor(video,1,300,165).every(c=>c<25));assert(cor(video,3,300,165)[1]>180);assert(cor(video,3,10,10)[2]>180);
  const metade=path.join(raiz,'metade.mp4');fs.copyFileSync(path.join(raiz,'conteudo.mp4'),metade);const c=cfg(null,true);c.marca.opacidade=50;
  await identidade.aplicar(metade,c,'rapida');const rgb=cor(metade,1,300,165);assert(rgb[1]>70&&rgb[1]<190);assert(rgb[2]>70&&rgb[2]<190);
});
test('vinheta no fim e marca também nela funcionam sem áudio de origem',async()=>{
  const video=path.join(raiz,'fim.mp4');fs.copyFileSync(semSom,video);const r=await identidade.aplicar(video,cfg('fim',true,true),'rapida');
  assert.equal(r.deslocamento,0);const i=await media.inspecionar(video);assert(Math.abs(i.duracao-5)<.12);assert(i.temAudio);
  assert(cor(video,1,160,90)[2]>200);assert(cor(video,4,160,90)[0]>200);assert(cor(video,4,300,165)[1]>180);
});
test('marca sozinha preserva duração de vídeo sem áudio',async()=>{
  const video=path.join(raiz,'so-marca.mp4');fs.copyFileSync(semSom,video);await identidade.aplicar(video,cfg(null,true),'rapida');const i=await media.inspecionar(video);assert(Math.abs(i.duracao-3)<.1);assert.equal(i.temAudio,false);
});
test('SRT desloca apenas a apresentação, sem perder palavras do corte',()=>{
  const arq=path.join(raiz,'fala.srt');legenda.gerarSrt([{inicio:10,fim:11,texto:'Olá'}],10,arq,2);assert.match(fs.readFileSync(arq,'utf8'),/00:00:02,000 --> 00:00:03,000/);
});
test('upload rejeita vídeo curto e arquivos com tipo inválido',async()=>{
  const curto=path.join(raiz,'curto.mp4');ff(['-f','lavfi','-i','color=red:s=32x32:d=1','-c:v','libx264',curto]);await assert.rejects(upload('vinheta',curto),/pelo menos 2/);
  const r=Readable.from(Buffer.from('invalido'));r.headers={};await assert.rejects(identidade.receber(r,'marca','malicioso.svg'),/PNG/);
});

test('reeditar preserva identidade do projeto e não duplica vinheta', async()=>{
  const { refazerClipe } = require('../src/pipeline');
  const projeto=path.join(raiz,'projeto');fs.mkdirSync(projeto);fs.mkdirSync(pastas.trabalho(),{recursive:true});
  const c={numero:1,base:'clipe-1',nomeArquivo:'clipe-1.mp4',inicio:0,duracao:3,gancho:null,identidade:cfg('inicio',true)};
  fs.writeFileSync(path.join(projeto,'sessao.json'),JSON.stringify({video:path.join(raiz,'conteudo.mp4'),duracaoVideo:3,assinatura:'teste',opcoes:{formato:'original',qualidade:'rapida',legendar:false,identidade:c.identidade},clipes:[c]}));
  const primeiro=await refazerClipe({pasta:projeto,numero:1});
  identidade.salvar({}); // Alterar o padrão não modifica um clipe já criado.
  const segundo=await refazerClipe({pasta:projeto,numero:1});
  assert.equal(primeiro.deslocamentoConteudo,2);assert.equal(segundo.deslocamentoConteudo,2);assert.equal(segundo.duracao,3);
  assert(Math.abs((await media.inspecionar(segundo.arquivo)).duracao-5)<.15);assert.deepEqual(segundo.identidade,c.identidade);
});

test('edição de projeto antigo continua sem identidade nova por padrão', async()=>{
  const { refazerClipe } = require('../src/pipeline');
  identidade.salvar(cfg('inicio',true));
  const projeto=path.join(raiz,'legado');fs.mkdirSync(projeto);
  fs.writeFileSync(path.join(projeto,'sessao.json'),JSON.stringify({video:path.join(raiz,'conteudo.mp4'),duracaoVideo:3,assinatura:'legado',opcoes:{formato:'original',qualidade:'rapida'},clipes:[{numero:1,base:'clipe-1',nomeArquivo:'clipe-1.mp4',inicio:0,duracao:3}]}));
  const r=await refazerClipe({pasta:projeto,numero:1});assert.equal(r.deslocamentoConteudo,0);assert(Math.abs((await media.inspecionar(r.arquivo)).duracao-3)<.15);
});

test('marca transparente mantém o conteúdo visível sob os pixels sem alfa', async()=>{
  const png=path.join(raiz,'transparente.png'),rgba=Buffer.alloc(64*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<64;x++){const n=(y*64+x)*4;rgba[n+1]=255;rgba[n+3]=x<32?0:255;}
  execFileSync(ffmpeg,['-y','-v','error','-f','rawvideo','-pixel_format','rgba','-video_size','64x32','-i','pipe:0','-frames:v','1',png],{input:rgba,windowsHide:true});
  const a=await upload('marca',png),c=cfg(null,true);c.marca.arquivo=a.id;
  const video=path.join(raiz,'alfa.mp4');fs.copyFileSync(semSom,video);await identidade.aplicar(video,c,'rapida');
  assert(cor(video,1,260,160)[2]>180);assert(cor(video,1,310,160)[1]>180);
});

test('o caminho de renderização da live também aplica a identidade', async()=>{
  const {SessaoAoVivo}=require('../src/aovivo');
  const live=new SessaoAoVivo({url:'https://www.twitch.tv/teste',formato:'original',salvarOriginal:false,identidade:cfg('fim',true)},()=>{});
  live.pasta=path.join(raiz,'live');live.dir=path.join(raiz,'buffer');fs.mkdirSync(live.pasta);fs.mkdirSync(live.dir);
  live.pedacos=[{t0:0,dur:3,arquivo:path.join(raiz,'conteudo.mp4')}];live.nomeCanal='Teste';
  await live.renderizar({inicio:0,fim:3,origem:'manual',nota:70});
  assert.equal(live.clipes.length,1);const c=live.clipes[0];assert.equal(c.identidade.vinheta.posicao,'fim');assert(Math.abs((await media.inspecionar(c.arquivo)).duracao-5)<.15);assert.equal(c.duracao,3);
});

test('falha na identidade não substitui o arquivo de um clipe existente', async()=>{
  const {refazerClipe}=require('../src/pipeline');const projeto=path.join(raiz,'projeto');const destino=path.join(projeto,'clipe-1.mp4'),antes=fs.readFileSync(destino);
  const original=identidade.aplicar;identidade.aplicar=async()=>{throw new Error('Falha simulada de exportação');};
  try { await assert.rejects(refazerClipe({pasta:projeto,numero:1}),/Falha simulada/);assert.deepEqual(fs.readFileSync(destino),antes); }
  finally { identidade.aplicar=original; }
});

test('presets persistem separados da identidade limpa e preservam anexos ao excluir',()=>{
  const c=cfg('fim',true); const p=identidade.salvarPreset('Minha marca',c);
  identidade.salvar({});
  assert.deepEqual(identidade.publico({}).config,identidade.normalizar({}));
  assert.equal(identidade.publico({}).arquivos.marca,null);
  assert.deepEqual(identidade.carregarPreset(p.id).config,c);
  delete require.cache[require.resolve('../src/identidade')];
  const reaberto=require('../src/identidade');
  assert.equal(reaberto.presets().find(x=>x.id===p.id).nome,'Minha marca');
  assert.throws(()=>reaberto.salvarPreset('minha marca',c),/existe/);
  assert.throws(()=>reaberto.salvarPreset(' ',c),/nome/);
  assert.throws(()=>reaberto.salvarPreset('Inválido',{marca:{ativa:true}}),/imagem/);
  reaberto.excluirPreset(p.id);
  assert.throws(()=>reaberto.carregarPreset(p.id),/encontrado/);
  assert(reaberto.asset(c.marca.arquivo));assert(reaberto.asset(c.vinheta.arquivo));
  assert.equal(pastas.lerConfig().desempenho,'leve');
});
