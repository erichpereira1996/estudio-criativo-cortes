(() => {
  'use strict';
  const $ = id => document.getElementById(id), dialog = $('dialogIdentidade');
  const copiar = v => JSON.parse(JSON.stringify(v));
  let salvo, rascunho, arquivos = {}, arquivosSalvos = {}, upload = null, erroCarga = null, fundoUrl = null, abertura = 0;
  const campos = { x:'idX', y:'idY', tamanho:'idTamanho', opacidade:'idOpacidade', margem:'idMargem' };
  function status(msg, erro = false) { $('idStatus').textContent = msg; $('idStatus').classList.toggle('erro', erro); }
  async function json(url, opcoes) {
    const r = await fetch(url, opcoes), j = await r.json();
    if (!r.ok || j.erro) throw new Error(j.erro || 'Não foi possível salvar a identidade.');
    return j;
  }
  const pronto = json('/api/identidade?limpa=1').then(r => { salvo = r.config; arquivosSalvos = r.arquivos; restaurar(); }).catch(e => { erroCarga = e; });
  function restaurar() { rascunho = copiar(salvo); arquivos = copiar(arquivosSalvos); pintar(); resumo(); }
  function lerControles() {
    rascunho.vinheta.ativa = $('idVinhetaAtiva').checked;
    rascunho.vinheta.posicao = $('idPosicaoVinheta').value;
    rascunho.marca.ativa = $('idMarcaAtiva').checked;
    rascunho.marca.naVinheta = $('idNaVinheta').checked;
    for (const [key,id] of Object.entries(campos)) rascunho.marca[key] = Number($(id).value);
  }
  function pintar() {
    if (!rascunho) return;
    $('idVinhetaAtiva').checked = rascunho.vinheta.ativa;
    $('idPosicaoVinheta').value = rascunho.vinheta.posicao;
    $('idMarcaAtiva').checked = rascunho.marca.ativa;
    $('idNaVinheta').checked = rascunho.marca.naVinheta;
    for (const [key,id] of Object.entries(campos)) { $(id).value = rascunho.marca[key]; $(id+'Valor').textContent = Math.round(rascunho.marca[key]) + '%'; }
    $('idNomeVinheta').textContent = arquivos.vinheta ? arquivos.vinheta.nome : 'Nenhuma vinheta escolhida';
    $('idNomeMarca').textContent = arquivos.marca ? arquivos.marca.nome : 'Nenhuma imagem escolhida';
    const video = $('idVideoVinheta');
    video.hidden = !arquivos.vinheta;
    if (arquivos.vinheta && video.getAttribute('src') !== arquivos.vinheta.url) video.src = arquivos.vinheta.url;
    if (!arquivos.vinheta && video.hasAttribute('src')) { video.pause(); video.removeAttribute('src'); video.load(); }
    const logo = $('idPreviewLogo');
    logo.hidden = !(arquivos.marca && rascunho.marca.ativa);
    if (arquivos.marca && logo.getAttribute('src') !== arquivos.marca.url) logo.src = arquivos.marca.url;
    if (!arquivos.marca) logo.removeAttribute('src');
    for (const b of dialog.querySelectorAll('[data-id-pos]')) {
      const [x,y] = b.dataset.idPos.split(',').map(Number);
      b.setAttribute('aria-pressed', String(x === rascunho.marca.x && y === rascunho.marca.y));
    }
    preview();
  }
  function geometria() {
    const box = $('idPreview'), m = rascunho.marca, a = arquivos.marca;
    if (!a) return null;
    const largura = box.clientWidth, altura = box.clientHeight, aspecto = a.largura / a.altura;
    const w = Math.min(largura * m.tamanho / 100, altura * .45 * aspecto), h = w / aspecto;
    const margem = Math.min(largura,altura) * m.margem / 100;
    return { w, h, margem, livreX: Math.max(0, largura-w-2*margem), livreY: Math.max(0, altura-h-2*margem) };
  }
  function preview() {
    if (!rascunho) return;
    const g = geometria(); if (!g) return;
    const m = rascunho.marca;
    Object.assign($('idPreviewLogo').style, { width:g.w+'px', height:g.h+'px', left:(g.margem+g.livreX*m.x/100)+'px', top:(g.margem+g.livreY*m.y/100)+'px', opacity:m.opacidade/100 });
  }
  function resumo() {
    if (!salvo) return;
    const partes = [];
    if (salvo.vinheta.ativa) partes.push('Vinheta de 2s no ' + (salvo.vinheta.posicao === 'inicio' ? 'início' : 'fim'));
    if (salvo.marca.ativa) partes.push('Marca d’água ativada');
    document.querySelectorAll('[data-identidade-resumo]').forEach(e => e.textContent = partes.join(' · ') || 'Sem vinheta ou marca d’água. Configure quando quiser.');
  }
  async function abrir() {
    await pronto;
    if (erroCarga) { alert('Não consegui carregar a identidade: ' + erroCarga.message); return; }
    restaurar(); status('As escolhas valem nesta abertura do app. Salve um preset para reutilizá-las.');
    dialog.showModal();
    atualizarPresets().catch(e => status(e.message, true));
    const token = ++abertura;
    $('idPreviewFundo').hidden = true;
    $('idPreview').style.aspectRatio = '9 / 16';
    $('idPreviewNota').textContent = 'Prévia ilustrativa em 9:16. A posição é proporcional ao formato exportado.';
    const ctx = window.contextoIdentidade && window.contextoIdentidade();
    if (ctx && ctx.video) {
      try {
        const r = await fetch('/api/previa', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...ctx, segundo:1}) });
        if (!r.ok) throw new Error('Prévia indisponível');
        const blob = await r.blob();
        if (token !== abertura || !dialog.open) return;
        if (fundoUrl) URL.revokeObjectURL(fundoUrl);
        fundoUrl = URL.createObjectURL(blob);
        $('idPreviewFundo').src = fundoUrl;
        $('idPreviewFundo').hidden = false;
        $('idPreviewNota').textContent = 'Enquadramento do vídeo selecionado. A marca será aplicada em cada corte.';
      } catch (_) { $('idPreviewNota').textContent = 'Prévia ilustrativa. A imagem do vídeo não está disponível agora.'; }
    }
    preview();
  }
  function cancelar() {
    if (upload) { status('Espere o envio terminar para fechar.'); return; }
    ++abertura; $('idVideoVinheta').pause(); restaurar(); dialog.close();
  }
  function resetar() {
    if (upload || $('idSalvar').disabled) return;
    rascunho = {
      vinheta: { ativa: false, arquivo: null, posicao: 'inicio' },
      marca: { ativa: false, arquivo: null, x: 100, y: 100, tamanho: 18, opacidade: 75, margem: 3, naVinheta: false },
    };
    arquivos = { vinheta: null, marca: null };
    $('idArquivoVinheta').value = '';
    $('idArquivoMarca').value = '';
    pintar();
    status('Identidade limpa. Clique em Salvar identidade para gerar os próximos cortes sem vinheta e sem marca.');
  }
  async function enviar(tipo, file) {
    if (!file || upload) return;
    const limite = (tipo === 'marca' ? 10 : 100) * 1048576;
    if (file.size > limite) { status('Arquivo grande demais. Limite: ' + limite / 1048576 + ' MB.', true); return; }
    $('idSalvar').disabled = $('idResetar').disabled = true;
    $('idArquivoVinheta').disabled = $('idArquivoMarca').disabled = true;
    status('Enviando e verificando ' + file.name + '…');
    upload = json('/api/identidade/upload?tipo=' + tipo + '&nome=' + encodeURIComponent(file.name), { method:'POST', headers:{'Content-Type':'application/octet-stream'}, body:file });
    try {
      const r = await upload; arquivos[tipo] = r.arquivo;
      rascunho[tipo].arquivo = r.arquivo.id; rascunho[tipo].ativa = true;
      pintar(); status('Arquivo pronto. Salve a identidade para usar nos próximos cortes.');
    } catch (e) { status(e.message,true); }
    finally { upload = null; $('idSalvar').disabled = $('idResetar').disabled = false; $('idArquivoVinheta').disabled = $('idArquivoMarca').disabled = false; }
  }
  async function salvar() {
    await pronto;
    if (erroCarga) throw erroCarga;
    if (upload) throw new Error('Espere o envio da identidade terminar.');
    lerControles();
    const r = await json('/api/identidade', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(rascunho) });
    salvo = r.config; arquivosSalvos = r.arquivos; restaurar();
    window.dispatchEvent(new Event('identidade-salva'));
    return copiar(salvo);
  }
  async function atualizarPresets(selecionado = '') {
    const r = await json('/api/identidade/presets');
    $('idPreset').replaceChildren(new Option('Selecione um preset', ''), ...r.presets.map(p => new Option(p.nome, p.id)));
    $('idPreset').value = selecionado;
  }
  async function acaoPreset(acao) {
    if (upload || $('idSalvar').disabled) return;
    const botoes = ['idPresetSalvar','idPresetCarregar','idPresetExcluir','idSalvar','idResetar','idArquivoVinheta','idArquivoMarca'];
    botoes.forEach(id => $(id).disabled = true);
    try { await acao(); } catch(e) { status(e.message, true); }
    finally { botoes.forEach(id => $(id).disabled = false); }
  }
  $('idPresetSalvar').addEventListener('click', () => acaoPreset(async () => {
    lerControles();
    const p = await json('/api/identidade/presets', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nome:$('idPresetNome').value,config:rascunho}) });
    await atualizarPresets(p.id); $('idPresetNome').value = '';
    status('Preset salvo para outras aberturas do app. Clique em Salvar identidade para usar agora.');
  }));
  $('idPresetCarregar').addEventListener('click', () => acaoPreset(async () => {
    if (!$('idPreset').value) throw new Error('Selecione um preset.');
    const r = await json('/api/identidade/preset?id=' + encodeURIComponent($('idPreset').value));
    rascunho = r.config; arquivos = r.arquivos; pintar();
    status('Preset carregado. Clique em Salvar identidade para aplicar aos próximos cortes.');
  }));
  $('idPresetExcluir').addEventListener('click', () => acaoPreset(async () => {
    if (!$('idPreset').value) throw new Error('Selecione um preset.');
    if (!confirm('Excluir este preset salvo?')) return;
    await json('/api/identidade/presets?id=' + encodeURIComponent($('idPreset').value), { method:'DELETE' });
    await atualizarPresets(); status('Preset excluído. A identidade atual foi mantida.');
  }));
  window.identidadeUI = {
    abrir,
    async preparar() { await pronto; if (erroCarga) throw erroCarga; if (upload) throw new Error('Espere o envio da identidade terminar.'); return copiar(salvo); },
  };
  document.querySelectorAll('[data-abrir-identidade]').forEach(b=>b.addEventListener('click',abrir));
  $('idResetar').addEventListener('click',resetar);
  $('idFechar').addEventListener('click',cancelar); $('idCancelar').addEventListener('click',cancelar);
  dialog.addEventListener('cancel',e=>{e.preventDefault();cancelar();});
  $('idSalvar').addEventListener('click',async()=>{
    $('idSalvar').disabled = $('idResetar').disabled = true;
    try { await salvar(); status('Identidade salva.'); $('idVideoVinheta').pause(); dialog.close(); }
    catch(e) { status(e.message,true); }
    finally { $('idSalvar').disabled = $('idResetar').disabled = false; }
  });
  $('idArquivoVinheta').addEventListener('change',e=>{enviar('vinheta',e.target.files[0]);e.target.value='';});
  $('idArquivoMarca').addEventListener('change',e=>{enviar('marca',e.target.files[0]);e.target.value='';});
  for(const id of ['idVinhetaAtiva','idPosicaoVinheta','idMarcaAtiva','idNaVinheta',...Object.values(campos)]) $(id).addEventListener('input',()=>{lerControles();pintar();status('Alterações ainda não salvas.');});
  dialog.querySelectorAll('[data-id-pos]').forEach(b=>b.addEventListener('click',()=>{[rascunho.marca.x,rascunho.marca.y]=b.dataset.idPos.split(',').map(Number);pintar();status('Alterações ainda não salvas.');}));
  const logo=$('idPreviewLogo');let arraste=null;
  logo.addEventListener('pointerdown',e=>{e.preventDefault();logo.focus();const r=logo.getBoundingClientRect();arraste={x:e.clientX-r.left,y:e.clientY-r.top};logo.setPointerCapture(e.pointerId);});
  logo.addEventListener('pointermove',e=>{if(!arraste)return;const g=geometria(),r=$('idPreview').getBoundingClientRect();const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));rascunho.marca.x=clamp((e.clientX-r.left-arraste.x-g.margem)/Math.max(1,g.livreX)*100);rascunho.marca.y=clamp((e.clientY-r.top-arraste.y-g.margem)/Math.max(1,g.livreY)*100);pintar();status('Alterações ainda não salvas.');});
  for(const e of ['pointerup','pointercancel','lostpointercapture'])logo.addEventListener(e,()=>arraste=null);
  logo.addEventListener('keydown',e=>{const dirs={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',-1],ArrowDown:['y',1]};if(!dirs[e.key])return;e.preventDefault();const[k,d]=dirs[e.key];rascunho.marca[k]=Math.max(0,Math.min(100,rascunho.marca[k]+d*(e.shiftKey?10:1)));pintar();});
  $('idPreviewFundo').addEventListener('load',()=>{const i=$('idPreviewFundo');$('idPreview').style.aspectRatio=i.naturalWidth+' / '+i.naturalHeight;preview();});
  new ResizeObserver(preview).observe($('idPreview'));
  $('idVideoVinheta').addEventListener('timeupdate',()=>{const v=$('idVideoVinheta');if(v.currentTime>=2&&!v.paused){v.pause();v.currentTime=0;}});
  json('/api/versao').then(r=>{document.querySelectorAll('[data-versao-app]').forEach(e=>e.textContent=r.rotulo);}).catch(()=>{document.querySelectorAll('[data-versao-app]').forEach(e=>e.textContent='Versão indisponível');});
})();
