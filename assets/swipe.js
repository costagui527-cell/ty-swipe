(function(){
  var MODO = window.MESA_MODO;
  // Índice compacto (um array por criativo) -> registros leves.
  // Ver CONTINUAR.md para o significado de cada posição.
  var DADOS = window.MESA_DADOS;
  if(Array.isArray(window.MESA_ITENS)){
    var NOMES = window.MESA_PERFIS_NOMES || [];
    DADOS = new Array(window.MESA_ITENS.length);
    for(var i = 0; i < window.MESA_ITENS.length; i++){
      var a = window.MESA_ITENS[i], f = a[8];
      DADOS[i] = {
        number: a[0], perfil: NOMES[a[1]] || '', codigo: a[2],
        v: a[3], l: a[4], k: a[5],                    // views, curtidas, comentários
        dias: a[6], duration_s: a[7] || null,         // dias desde 2020-01-01 (-1 sem data)
        status_download: (f & 1) ? 'BAIXADO' : ((f & 2) ? 'ERRO' : 'PENDENTE'),
        top15: !!(f & 4), is_top: !!(f & 8), temCapa: !!(f & 16),
        tipo: (f & 32) ? 'post' : 'reel',
        legenda: a[11] || '', ganho: a[12] || 0,
        _lote: 'dados/lotes/' + String(a[9]).padStart(3, '0') + '.js', _pos: a[10], _i: i
      };
    }
    window.MESA_ITENS = null; window.MESA_PERFIS_NOMES = null;   // libera a memória do índice cru
  }
  // Ajustes do painel /admin (ajustes/ajustes.js): criativos e perfis novos, edições,
  // remoções e a lista de pendentes. Ficam por cima do catálogo, que não é reescrito.
  var AJUSTES = window.MESA_AJUSTES && typeof window.MESA_AJUSTES === 'object' ? window.MESA_AJUSTES : null;
  var TOTAL_INDICE = Array.isArray(DADOS) ? DADOS.length : 0;   // o índice de busca casa com estes, por _i
  if(AJUSTES && Array.isArray(DADOS)) DADOS = aplicarAjustes(DADOS, AJUSTES);

  function metricasDe(c){
    function m(n){ return {raw: fmtK(n).replace(',0', ''), num: n || 0}; }
    return {'comentários': m(c.k), views: m(c.v), likes: m(c.l)};
  }
  function aplicarEdicao(c, e){
    ['v', 'l', 'k', 'dias', 'data_publicacao', 'duration_s', 'legenda', 'top15', 'tipo', 'capa', 'video',
     'transcricao_audio', 'traducao_audio', 'language'].forEach(function(k){ if(e[k] !== undefined) c[k] = e[k]; });
    if(e.video) c.status_download = 'BAIXADO';
    if(e.capa) c.temCapa = true;
    if(e.tipo && c.codigo) c.url = 'https://www.instagram.com/' + (e.tipo === 'post' ? 'p' : 'reel') + '/' + c.codigo + '/';
    if(e.v !== undefined || e.l !== undefined || e.k !== undefined){ c.metrics = metricasDe(c); c.headline_metric_label = 'views'; }
    if(c.data_publicacao && c.capturado_em && Date.parse(c.data_publicacao) > Date.parse(c.capturado_em) + 3600000){
      var scDate = shortcodeToDate(c.codigo);
      if(scDate) c.data_publicacao = scDate.toISOString();
    }
  }
  function aplicarAjustes(dados, aj){
    var removidos = {}, ocultos = {}, editados = aj.editados || {}, novos = {}, maiorNumero = {};
    (aj.removidos || []).forEach(function(cod){ removidos[cod] = true; });
    (aj.perfis_ocultos || []).forEach(function(p){ ocultos[String(p).toLowerCase()] = true; });
    var criativos = aj.criativos || {};
    Object.keys(criativos).forEach(function(cod){ novos[cod] = true; });
    var saida = [];
    for(var i = 0; i < dados.length; i++){
      var c = dados[i];
      if(removidos[c.codigo] || novos[c.codigo] || ocultos[(c.perfil || '').toLowerCase()]) continue;
      if(editados[c.codigo]){ c._edicao = editados[c.codigo]; aplicarEdicao(c, c._edicao); }
      if(!maiorNumero[c.perfil] || c.number > maiorNumero[c.perfil]) maiorNumero[c.perfil] = c.number;
      saida.push(c);
    }
    Object.keys(criativos).forEach(function(cod){
      var r = criativos[cod];
      if(!r || removidos[cod] || ocultos[(r.perfil || '').toLowerCase()]) return;
      var c = {
        number: r.number || ((maiorNumero[r.perfil] || 0) + 1), perfil: r.perfil, codigo: cod,
        v: r.v || 0, l: r.l || 0, k: r.k || 0, dias: r.dias != null ? r.dias : -1, duration_s: r.duration_s || null,
        status_download: r.video ? 'BAIXADO' : 'PENDENTE', top15: !!r.top15, is_top: false, temCapa: !!r.capa,
        tipo: r.tipo === 'post' ? 'post' : 'reel', legenda: r.legenda || '', ganho: 0,
        url: 'https://www.instagram.com/' + (r.tipo === 'post' ? 'p' : 'reel') + '/' + cod + '/',
        data_publicacao: r.data_publicacao || '', language: r.language || '',
        transcricao_audio: r.transcricao_audio || '', traducao_audio: r.traducao_audio || '',
        analysis: Array.isArray(r.analysis) ? r.analysis : [],
        capa: r.capa || '', video: r.video || '', headline_metric_label: 'views',
        _completo: true, _admin: true
      };
      if(c.number > (maiorNumero[c.perfil] || 0)) maiorNumero[c.perfil] = c.number;
      c.metrics = metricasDe(c);
      c.search_blob = [cod, c.perfil, c.legenda, c.transcricao_audio, c.traducao_audio].join(' ');
      saida.push(c);
    });
    return saida;
  }
  if(!Array.isArray(DADOS)){
    // Sem o arquivo de dados o painel inteiro quebraria em silêncio: avisa no lugar da grade.
    var vistaSemDados = document.getElementById('vista-criativos'), avisoSemDados = document.getElementById('aviso-catalogo');
    if(vistaSemDados) vistaSemDados.hidden = false;
    if(avisoSemDados) avisoSemDados.textContent = 'Dados não encontrados. Mantenha a pasta dados/ ao lado do HTML.';
    return;
  }
  var config = window.MESA_CONFIG || {}, meuSwipe = false, modoDia = false, pagina = 0, pedidoFicha = 0;
  var favoritos = new Set();
  try { var salvos = JSON.parse(localStorage.getItem('mesa-favoritos-v1') || '[]'); if(Array.isArray(salvos)) favoritos = new Set(salvos.filter(function(x){return typeof x === 'string';})); } catch(e) {}
  // "Do Dia": top das últimas 48h (views + comentários), calculado na nuvem (dados/do-dia.js)
  var DO_DIA = (window.MESA_DO_DIA && Array.isArray(window.MESA_DO_DIA.codigos)) ? window.MESA_DO_DIA : {codigos: [], atualizado_em: ''};
  var DIA_SET = new Set(DO_DIA.codigos);
  var DIA_RANK = {}; DO_DIA.codigos.forEach(function(c, i){ DIA_RANK[c] = i; });
  function identidade(c){ return c.codigo || c.id || ((c.perfil || '') + ':' + c.number); }
  function aviso(texto){ var el = document.getElementById('aviso-catalogo'); if(el) el.textContent = texto; }
  // ---- Carregamento de Lotes (desacoplado e com cache em memória) --------
  var cacheLotes = {};
  var promessasLotes = {};

  async function carregarLote(src){
    if(!src) throw new Error('Caminho do lote não especificado.');
    if(cacheLotes[src]) return cacheLotes[src];
    if(promessasLotes[src]) return promessasLotes[src];

    promessasLotes[src] = (async function(){
      try {
        var res = await fetch(src);
        if(!res.ok) throw new Error('HTTP ' + res.status);
        var code = await res.text();
        var fakeWin = {};
        try {
          var fn = new Function('window', code + '\nreturn window.MESA_LOTE;');
          var resultado = fn(fakeWin);
          if(!Array.isArray(resultado)) resultado = fakeWin.MESA_LOTE || window.MESA_LOTE;
          if(Array.isArray(resultado)){
            cacheLotes[src] = resultado;
            return resultado;
          }
        } catch(evalErr) {
          console.warn('Fallback no parse do lote:', evalErr);
        }
      } catch(fetchErr) {
        // Fallback para script tag caso fetch falhe
      }

      return new Promise(function(resolve, reject){
        var script = document.createElement('script');
        var timer = setTimeout(function(){
          script.remove();
          reject(new Error('Tempo esgotado ao ler lote'));
        }, 10000);
        script.onload = function(){
          clearTimeout(timer);
          var valor = window.MESA_LOTE;
          delete window.MESA_LOTE;
          script.remove();
          if(Array.isArray(valor)){
            cacheLotes[src] = valor;
            resolve(valor);
          } else {
            reject(new Error('Lote vazio'));
          }
        };
        script.onerror = function(){
          clearTimeout(timer);
          script.remove();
          reject(new Error('Erro ao carregar script do lote'));
        };
        script.src = src;
        document.head.appendChild(script);
      });
    })().finally(function(){
      delete promessasLotes[src];
    });

    return promessasLotes[src];
  }

  // Compatibilidade caso algum ponto ainda chame carregarArquivo
  function carregarArquivo(src, variavel){
    if(variavel === 'MESA_LOTE') return carregarLote(src);
    return carregarBuscaArquivo(src);
  }

  // ---- Índice de Busca (execução isolada em fila própria) -----------------
  var filaBusca = Promise.resolve();
  var carregamentosBusca = {};

  function carregarBuscaArquivo(src){
    if(carregamentosBusca[src]) return carregamentosBusca[src];
    var trabalho = filaBusca.catch(function(){}).then(function(){
      return new Promise(function(resolve, reject){
        var script = document.createElement('script');
        var timer = setTimeout(function(){
          terminar(new Error('Tempo de carregamento esgotado no índice de busca.'));
        }, 30000);
        function terminar(erro){
          clearTimeout(timer);
          script.remove();
          if(erro) reject(erro);
          else {
            var valor = window.MESA_BUSCA;
            delete window.MESA_BUSCA;
            resolve(valor);
          }
        }
        script.onload = function(){ terminar(); };
        script.onerror = function(){ terminar(new Error('Arquivo auxiliar de busca indisponível.')); };
        script.src = src;
        document.head.appendChild(script);
      });
    });
    filaBusca = trabalho;
    carregamentosBusca[src] = trabalho.catch(function(e){
      delete carregamentosBusca[src];
      throw e;
    });
    return carregamentosBusca[src];
  }

  var BUSCA_PARTES = [].concat(config.busca || []);
  var buscaPronta = !BUSCA_PARTES.length, buscaPendente = false;

  function prepararBusca(){
    if(buscaPronta || buscaPendente || !BUSCA_PARTES.length) return;
    buscaPendente = true;
    var feitas = 0;
    function passo(){
      if(feitas >= BUSCA_PARTES.length){
        var blobs = window.MESA_BUSCA_TOTAL || [];
        if(blobs.length !== TOTAL_INDICE){
          buscaPendente = false;
          return;
        }
        for(var i = 0; i < DADOS.length; i++){
          if(DADOS[i]._i != null) DADOS[i].search_blob = blobs[DADOS[i]._i];
        }
        window.MESA_BUSCA_TOTAL = null;
        buscaPronta = true;
        aviso('');
        filtrar();
        return;
      }
      if(q && q.value.trim()) aviso('Carregando índice de busca… ' + (feitas + 1) + '/' + BUSCA_PARTES.length);
      return carregarBuscaArquivo(BUSCA_PARTES[feitas]).then(function(parte){
        if(!Array.isArray(parte)) throw new Error('Índice de busca inválido.');
        window.MESA_BUSCA_TOTAL = (window.MESA_BUSCA_TOTAL || []).concat(parte);
        feitas++;
        return passo();
      });
    }
    Promise.resolve().then(passo)
      .catch(function(e){
        window.MESA_BUSCA_TOTAL = null;
        if(q && q.value.trim()) aviso(e.message + ' Digite novamente para tentar.');
      })
      .finally(function(){ buscaPendente = false; });
  }

  // Prepara busca apenas sob demanda (foco/digitação) ou ocioso, sem travar a navegação inicial
  if(q){
    q.addEventListener('focus', function(){ prepararBusca(); }, {once: true});
    q.addEventListener('input', function(){ if(q.value.trim().length > 1) prepararBusca(); });
  }
  if('requestIdleCallback' in window){
    window.requestIdleCallback(function(){ prepararBusca(); }, {timeout: 10000});
  } else {
    setTimeout(prepararBusca, 6000);
  }
  var PERFIS_META = ajustarMeta((function(){
    // Le do bloco <script type="application/json">. Um build gerado por uma
    // versao antiga do swipe.py deixa o placeholder cru ali; nesse caso o
    // JSON.parse falha e seguimos sem o dado, sem derrubar o painel.
    try {
      var el = document.getElementById('perfis-meta');
      if(el && el.textContent){
        var meta = JSON.parse(el.textContent);
        if(meta && typeof meta === 'object') return meta;
      }
    } catch(e) {}
    return window.MESA_PERFIS_META || {};
  })());
  // Perfis criados/editados no admin entram nos metadados; os ocultos saem.
  function ajustarMeta(meta){
    if(!AJUSTES) return meta;
    var perfis = AJUSTES.perfis || {}, ocultos = {};
    (AJUSTES.perfis_ocultos || []).forEach(function(p){ ocultos[String(p).toLowerCase()] = true; });
    Object.keys(perfis).forEach(function(p){
      var atual = meta[p] || {}, novo = {};
      Object.keys(atual).forEach(function(k){ novo[k] = atual[k]; });
      Object.keys(perfis[p] || {}).forEach(function(k){ if(perfis[p][k] !== '' && perfis[p][k] != null) novo[k] = perfis[p][k]; });
      meta[p] = novo;
    });
    Object.keys(meta).forEach(function(p){ if(ocultos[p.toLowerCase()]) delete meta[p]; });
    return meta;
  }
  var perfisUi = window.MesaPerfisLogica;

  // Perfis ainda não coletados (lista manual) — quem já está em DADOS some daqui automaticamente.
  var PENDENTES = (AJUSTES && Array.isArray(AJUSTES.pendentes)) ? AJUSTES.pendentes : (window.MESA_PENDENTES || []);

  var grade = document.getElementById('grade');
  var tela = document.getElementById('tela');
  var ficha = document.getElementById('ficha');
  tela.setAttribute('tabindex', '-1');   // o diálogo recebe o foco ao abrir
  var framesUi = window.MesaFrames;
  var frameViewer = document.createElement('div');
  var frameViewerFrames = [], frameViewerIndex = -1;
  frameViewer.className = 'frame-viewer';
  frameViewer.hidden = true;
  frameViewer.setAttribute('role', 'dialog');
  frameViewer.setAttribute('aria-modal', 'true');
  frameViewer.setAttribute('aria-label', 'Frame ampliado');
  frameViewer.innerHTML =
    '<button class="frame-viewer-fechar" type="button" aria-label="Fechar frame">×</button>' +
    '<button class="frame-viewer-nav frame-viewer-ant" type="button" aria-label="Frame anterior">←</button>' +
    '<figure><img alt=""><figcaption></figcaption></figure>' +
    '<button class="frame-viewer-nav frame-viewer-prox" type="button" aria-label="Próximo frame">→</button>';
  document.body.appendChild(frameViewer);
  var q = document.getElementById('q');
  var selPerfil = document.getElementById('filtro-perfil');
  var selNicho = document.getElementById('filtro-nicho');
  var selNichoSwipers = document.getElementById('filtro-nicho-swipers');
  var selStatus = document.getElementById('filtro-status');
  var selPeriodo = document.getElementById('filtro-periodo');
  var selViews = document.getElementById('filtro-views');
  var ordem = document.getElementById('ordem');
  var ordem2 = document.getElementById('ordem2');
  var qSwipers = document.getElementById('q-swipers');
  var conta = document.getElementById('conta');
  var sentinela = document.getElementById('sentinela');

  var secaoSwipers = document.getElementById('swipers');
  var vistaCriativos = document.getElementById('vista-criativos');
  var controlesCriativos = document.getElementById('controles-criativos');
  var controlesSwipers = document.getElementById('controles-swipers');
  var abaSwipers = document.getElementById('aba-swipers');
  var abaCriativos = document.getElementById('aba-criativos');
  var perfilCabecalho = document.getElementById('perfil-cabecalho');

  function atualizarFrameViewer(){
    if(frameViewerIndex < 0 || !frameViewerFrames.length) return;
    var total = frameViewerFrames.length;
    frameViewer.querySelector('img').src = frameViewerFrames[frameViewerIndex];
    frameViewer.querySelector('img').alt = 'Frame ' + (frameViewerIndex + 1) + ' de ' + total;
    frameViewer.querySelector('figcaption').textContent = (frameViewerIndex + 1) + ' / ' + total;
    frameViewer.querySelector('.frame-viewer-ant').disabled = frameViewerIndex === 0;
    frameViewer.querySelector('.frame-viewer-prox').disabled = frameViewerIndex === total - 1;
  }

  function abrirFrame(frames, indice){
    frameViewerFrames = framesUi ? framesUi.normalizarFrames(frames) : [];
    if(!frameViewerFrames.length) return;
    frameViewerIndex = framesUi.moveIndex(indice, frameViewerFrames.length, 0);
    atualizarFrameViewer();
    if(frameViewer.hidden) focoAntesFrame = document.activeElement;
    frameViewer.hidden = false;
    frameViewer.querySelector('.frame-viewer-fechar').focus();
  }

  var focoAntesFrame = null;
  function fecharFrame(){
    var estavaAberto = !frameViewer.hidden;
    frameViewer.hidden = true;
    frameViewerFrames = [];
    frameViewerIndex = -1;
    frameViewer.querySelector('img').removeAttribute('src');
    // devolve o foco à miniatura que abriu o frame
    if(estavaAberto && focoAntesFrame && focoAntesFrame.isConnected) focoAntesFrame.focus({preventScroll: true});
    focoAntesFrame = null;
  }

  function moverFrame(delta){
    var novo = framesUi.moveIndex(frameViewerIndex, frameViewerFrames.length, delta);
    if(novo === frameViewerIndex) return;
    frameViewerIndex = novo;
    atualizarFrameViewer();
  }

  // Título e subtítulo do topo (Madruga Swipe), conforme a aba.
  function atualizarCabecalhoPagina(nome){
    var h1 = document.getElementById('titulo-pagina'), sub = document.getElementById('sub-pagina');
    if(!h1 || !sub) return;
    var fmt = function(n){ return Number(n).toLocaleString('pt-BR'); };
    if(nome === 'swipers'){
      h1.textContent = 'Swipers';
      sub.textContent = fmt(agregarPerfis().ordem.length) + ' perfis · ' + fmt(DADOS.length) + ' criativos';
    } else if(nome === 'meu'){
      h1.textContent = 'Meu swipe';
      sub.textContent = 'Criativos salvos neste navegador';
    } else if(nome === 'dia'){
      h1.textContent = '☀️ Do Dia';
      sub.textContent = 'Top ' + DO_DIA.codigos.length + ' das últimas 48h · views + comentários' + (DO_DIA.atualizado_em ? ' · ' + DO_DIA.atualizado_em : '');
    } else {
      h1.textContent = 'Biblioteca';
      sub.textContent = fmt(DADOS.length) + ' criativos · busca em transcrições, legendas, perfis e hashtags';
    }
  }

  function mostrarAba(nome){
    atualizarCabecalhoPagina(nome);
    var ehSwipers = nome === 'swipers';
    meuSwipe = nome === 'meu';
    modoDia = nome === 'dia';
    var abaMeu = document.getElementById('aba-meu');
    if(abaMeu){abaMeu.classList.toggle('ativa', meuSwipe); abaMeu.setAttribute('aria-selected', String(meuSwipe));}
    var abaDia = document.getElementById('aba-dia');
    if(abaDia){abaDia.classList.toggle('ativa', modoDia); abaDia.setAttribute('aria-selected', String(modoDia));}
    var pessoal = document.getElementById('swipe-pessoal'); if(pessoal) pessoal.hidden = !meuSwipe;
    secaoSwipers.hidden = !ehSwipers;
    vistaCriativos.hidden = ehSwipers;
    controlesCriativos.hidden = ehSwipers;
    if(controlesSwipers) controlesSwipers.hidden = !ehSwipers;
    abaSwipers.classList.toggle('ativa', ehSwipers);
    abaCriativos.classList.toggle('ativa', nome === 'criativos');
    abaSwipers.setAttribute('aria-selected', String(ehSwipers));
    abaCriativos.setAttribute('aria-selected', String(nome === 'criativos'));
    if(ehSwipers) renderPerfis(); else filtrar();
  }
  abaSwipers.addEventListener('click', function(){ mostrarAba('swipers'); });
  abaCriativos.addEventListener('click', function(){ selPerfil.value = ''; mostrarAba('criativos'); });
  window.mostrarAba = mostrarAba;
  var abaMeu = document.getElementById('aba-meu');
  if(abaMeu) abaMeu.onclick = function(){ q.value = ''; selPerfil.value = ''; selStatus.value = ''; mostrarAba('meu'); };
  var abaDia = document.getElementById('aba-dia');
  if(abaDia) abaDia.onclick = function(){ q.value = ''; selPerfil.value = ''; selStatus.value = ''; mostrarAba('dia'); };
  var exportar = document.getElementById('exportar-favoritos');
  if(exportar) exportar.onclick = function(){
    var url = URL.createObjectURL(new Blob([JSON.stringify(Array.from(favoritos), null, 2)], {type:'application/json'}));
    var a = document.createElement('a'); a.href = url; a.download = 'meu-swipe-favoritos.json'; a.click(); setTimeout(function(){URL.revokeObjectURL(url);}, 1000);
  };
  var importar = document.getElementById('importar-favoritos');
  if(importar) importar.onchange = async function(){
    if(!importar.files || !importar.files[0]) return;
    try { var valores = JSON.parse(await importar.files[0].text());
      if(!Array.isArray(valores) || !valores.every(function(x){return typeof x === 'string';})) throw new Error('Arquivo de favoritos inválido.');
      var novos = new Set(Array.from(favoritos).concat(valores));
      localStorage.setItem('mesa-favoritos-v1', JSON.stringify(Array.from(novos))); favoritos = novos; filtrar(); aviso('Favoritos importados.');
    } catch(e){aviso('Não foi possível importar: ' + e.message);} importar.value = '';
  };

  var lista = DADOS.slice(), desenhados = 0, atual = -1;
  var PASSO = 48;

  // Configurar seletor de perfis
  var contagemPerfis = {};
  DADOS.forEach(function(c){
    var p = c.perfil || '';
    if(p) contagemPerfis[p] = (contagemPerfis[p] || 0) + 1;
  });
  // Mesmo conjunto da grade de Swipers (metadados + dados): senão clicar num perfil
  // só com metadados não acha a opção e a Biblioteca abre sem filtro.
  var perfisUnicos = (perfisUi
    ? perfisUi.perfisConhecidos(DADOS, PERFIS_META)
    : Object.keys(PERFIS_META).concat(Object.keys(contagemPerfis).filter(function(p){ return !Object.prototype.hasOwnProperty.call(PERFIS_META, p); }))).sort();
  function atualizarOpcoesPerfis(nichoAlvo){
    if(!selPerfil) return;
    var nichosMapa = window.MESA_PERFIS_NICHOS || {};
    var filtrados = perfisUnicos.filter(function(p){
      if(!nichoAlvo) return true;
      return (nichosMapa[p.toLowerCase()] || '🌐 Geral / Outros') === nichoAlvo;
    });
    var valorAtual = selPerfil.value;
    selPerfil.innerHTML = '<option value="">' + (nichoAlvo ? 'Todos os perfis deste nicho (' + filtrados.length + ')' : 'Todos os perfis (' + filtrados.length + ')') + '</option>' +
      filtrados.map(function(p){
        return '<option value="' + esc(p) + '">@' + esc(p) + ' (' + (contagemPerfis[p] || 0) + ')</option>';
      }).join('');
    if(valorAtual && filtrados.indexOf(valorAtual) !== -1){
      selPerfil.value = valorAtual;
    } else {
      selPerfil.value = '';
    }
  }

  if(perfisUnicos.length > 0 && selPerfil){
    atualizarOpcoesPerfis('');
    selPerfil.onchange = function(){
      if(q) q.value = '';
      filtrar();
    };
  } else if (selPerfil) {
    selPerfil.style.display = 'none';
  }
  if(selStatus){
    selStatus.onchange = filtrar;
  }

  window.filtrarPorPerfil = function(p){
    if(selPerfil){
      if(selNicho) selNicho.value = '';
      if(selNichoSwipers) selNichoSwipers.value = '';
      atualizarOpcoesPerfis('');
      atualizarBotaoVerCriativos();
      selPerfil.value = p;
      if(q) q.value = '';
      mostrarAba('criativos');   // já chama filtrar()
    }
  };

  window.filtrarPorNicho = function(nicho, irParaBiblioteca){
    var nichoVal = (nicho || '').trim();
    if(selNicho) selNicho.value = nichoVal;
    if(selNichoSwipers) selNichoSwipers.value = nichoVal;
    if(q) q.value = '';
    if(selPerfil){
      atualizarOpcoesPerfis(nichoVal);
      selPerfil.value = '';
    }
    atualizarBotaoVerCriativos();
    if(irParaBiblioteca){
      mostrarAba('criativos');
    } else {
      if(!secaoSwipers.hidden) renderPerfis();
      if(!vistaCriativos.hidden) filtrar();
    }
  };

  function atualizarBotaoVerCriativos(){
    var btn = document.getElementById('btn-ver-criativos-nicho');
    if(!btn) return;
    var n = selNichoSwipers ? selNichoSwipers.value : '';
    if(n){
      btn.style.display = 'inline-flex';
      btn.textContent = 'Ver Criativos do Nicho →';
    } else {
      btn.style.display = 'none';
    }
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  var GUIAS_ANALISE = {
    avatar: {
      titulo: 'Como analisar o avatar',
      passos: [
        '<b>Quantidade e papel</b> — quantos avatares aparecem e a função de cada um: autoridade (médico, monge, "vovó sábia"), paciente/vítima (representa o público-alvo) ou prova visual (parte do corpo usada só pra ilustrar a dor).',
        '<b>Dados demográficos</b> — etnia/nacionalidade aparente, faixa etária estimada, gênero.',
        '<b>Aparência física</b> — cabelo (cor, corte), vestuário (peça, cor, estilo), marcas físicas relevantes (rugas, óculos, luvas).',
        '<b>Papel arquetípico</b> — a função narrativa que ele representa (ex: "mestre oriental", "paciente transformada").',
        '<b>Comportamento e cenário</b> — tom de voz, postura, gestos e elementos de fundo que reforçam o papel.',
        '<b>Múltiplos avatares</b> — numere (1)...(2)... e destaque a relação entre eles (autoridade vs. paciente, before/after).'
      ]
    },
    frame: {
      titulo: 'Como analisar o primeiro frame',
      passos: [
        '<b>Composição</b> — quem/o que está à esquerda e à direita, plano aberto ou fechado, divisão da cena (ex: comparação lado a lado).',
        '<b>Elementos de prova</b> — o que já aparece mostrando o problema/dor logo de cara (ex: manequim, barriga exposta, produto em uso).',
        '<b>Ação no frame</b> — o que os personagens estão fazendo (apontando, levantando a blusa, segurando algo).',
        '<b>Cenário e iluminação</b> — ambiente (consultório, varanda, templo), luz natural ou artificial.',
        '<b>Legenda visível</b> — se já existe texto na tela nesse exato frame, transcrever.',
        '<b>Função do frame</b> — explicar por que esse recorte foi escolhido como thumbnail/gancho (o que ele promete resolver).'
      ]
    },
    formato: {
      titulo: 'Como analisar o formato dominante',
      passos: [
        '<b>Identifique o formato-base</b> — Talking Head, Native Reel/trend, Demonstração/tutorial, UGC testemunho, etc.',
        '<b>Combinações</b> — quase sempre há mistura (ex: "Talking Head combinado com demonstração visual no abre"). Descreva as duas partes.',
        '<b>Estrutura temporal</b> — o que domina no começo, meio e fim (ex: "primeiro terço é hook musical, últimos frames viram talking head de CTA").',
        '<b>Elementos de apoio</b> — overlays gráficos, ilustrações animadas, uso de trend/música.',
        '<b>O que predomina</b> — feche dizendo qual formato ocupa a maior parte do tempo de tela.'
      ]
    },
    legenda: {
      titulo: 'Como analisar a legenda',
      passos: [
        '<b>Posição e formato</b> — onde fica na tela (inferior, centro-superior), estática ou dinâmica linha a linha.',
        '<b>Tipografia</b> — caixa-alta/baixa, fonte (sans-serif bold), contorno, cor do texto e do fundo.',
        '<b>Sincronização</b> — se acompanha a fala em blocos curtos (2-3 palavras) ou aparece em blocos maiores.',
        '<b>Destaques</b> — palavras-chave com cor/fundo diferente (ex: termos de mecanismo ou emocionais destacados).',
        '<b>Cobertura</b> — a legenda cobre o vídeo inteiro ou só aparece em trechos específicos (ex: só no CTA final)?',
        '<b>Estilo de referência</b> — comparar com um padrão conhecido (ex: "estilo sticker TikTok/Reels").'
      ]
    },
    edicao: {
      titulo: 'Como analisar o tipo de edição',
      passos: [
        '<b>Ritmo de corte</b> — cortes secos, jump cuts, ritmo lento/médio/rápido, cortes no beat da música.',
        '<b>Movimento de câmera</b> — plano fixo, zooms, sem zooms agressivos.',
        '<b>Camadas gráficas</b> — overlays, ilustrações animadas, B-roll intercalado, e em que momento aparecem.',
        '<b>Uso de áudio/música</b> — se a edição segue uma trilha/trend, efeitos sonoros, ou depende só da fala.',
        '<b>Transições estruturais</b> — mudanças de plano que marcam virada emocional (ex: fechamento mais aberto/sorridente).',
        '<b>Amarração com o roteiro</b> — como a edição reforça a autoridade do avatar ou condensa a copy.'
      ]
    },
    provas: {
      titulo: 'Como analisar as provas visuais',
      passos: [
        '<b>Liste e numere</b> — identifique cada prova visual separadamente: (1), (2), (3)... não misture tudo em um parágrafo só.',
        '<b>Classifique o tipo de prova</b> — prova de dor/problema (corpo, sintoma), prova de autoridade (cenário, credencial, vestuário), prova de produto/uso, prova social (ambiente, contexto geográfico).',
        '<b>Ligue com a copy</b> — explique o que cada prova está validando ou ilustrando do que é dito na narração.',
        '<b>Observe ausências</b> — vale registrar quando falta algo esperado (ex: "sem gráficos, sem before/after").',
        '<b>Ordem de aparição</b> — se relevante, indicar em que momento do vídeo cada prova aparece.'
      ]
    }
  };

  function chaveGuiaParaRotulo(rotulo){
    var l = (rotulo || '').toLowerCase();
    if(l.indexOf('avatar') !== -1) return 'avatar';
    if(l.indexOf('primeiro frame') !== -1) return 'frame';
    if(l.indexOf('formato') !== -1) return 'formato';
    if(l.indexOf('legenda') !== -1) return 'legenda';
    if(l.indexOf('edi') !== -1) return 'edicao';
    if(l.indexOf('prova') !== -1) return 'provas';
    return null;
  }

  var guiaPopEl = null;
  function garantirGuiaPop(){
    if(guiaPopEl) return guiaPopEl;
    guiaPopEl = document.createElement('div');
    guiaPopEl.className = 'guia-pop';
    guiaPopEl.id = 'guiaPop';
    guiaPopEl.setAttribute('role', 'dialog');
    guiaPopEl.setAttribute('aria-label', 'Guia de análise');
    guiaPopEl.innerHTML = '<button class="guia-pop-fechar" id="guiaPopFechar" aria-label="Fechar guia">&#10005;</button><div id="guiaPopCorpo"></div>';
    document.body.appendChild(guiaPopEl);
    return guiaPopEl;
  }

  function abrirGuia(chave, ancora){
    var guia = GUIAS_ANALISE[chave];
    if(!guia) return;
    var pop = garantirGuiaPop();
    var corpo = pop.querySelector('#guiaPopCorpo');
    corpo.innerHTML = '<h3>' + esc(guia.titulo) + '</h3><ol>' + guia.passos.map(function(p){ return '<li>' + p + '</li>'; }).join('') + '</ol>';
    pop.classList.add('aberto');
    var rect = ancora.getBoundingClientRect();
    var popW = 360;
    var left = Math.min(rect.left, window.innerWidth - popW - 16);
    left = Math.max(16, left);
    var top = rect.bottom + 8;
    if(top + 260 > window.innerHeight){ top = Math.max(16, rect.top - 8 - 260); }
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function fecharGuia(){
    if(!guiaPopEl) return;
    guiaPopEl.classList.remove('aberto');
    Array.prototype.forEach.call(document.querySelectorAll('.guia-icone.ativo'), function(el){ el.classList.remove('ativo'); });
  }

  document.addEventListener('click', function(e){
    var btn = e.target.closest ? e.target.closest('.guia-icone') : null;
    if(btn){
      e.stopPropagation();
      var jaAtivo = btn.classList.contains('ativo');
      fecharGuia();
      if(!jaAtivo){
        btn.classList.add('ativo');
        abrirGuia(btn.getAttribute('data-guia'), btn);
      }
      return;
    }
    if(e.target.id === 'guiaPopFechar'){ fecharGuia(); return; }
    if(!e.target.closest || !e.target.closest('#guiaPop')){ fecharGuia(); }
  });
  document.addEventListener('keydown', function(e){
    // Com o guia aberto, o Esc fecha só o guia (preventDefault avisa a ficha).
    if(e.key === 'Escape' && guiaPopEl && guiaPopEl.classList.contains('aberto')){ fecharGuia(); e.preventDefault(); }
  });
  var MAX_CAPAS_PERFIL = 40;

  // Renderiza a foto do perfil com as capas alternativas em data-capas:
  // se o arquivo nao existir no disco, onerror tenta a proxima e, no fim,
  // cai na inicial em vez de deixar o quadro quebrado.
  function fotoPerfil(g, cls, inicial){
    // A foto real do perfil (capturada pela extensao) vem primeiro; as capas
    // dos criativos ficam de reserva pra quem ainda nao foi sincronizado.
    var lista = (g.capas && g.capas.length) ? g.capas.slice() : (g.capa ? [g.capa] : []);
    if(g.fotoPerfilUrl) lista.unshift(g.fotoPerfilUrl);
    if(!lista.length) return '<span class="' + cls + ' ' + cls + '-vazia vazia">' + inicial + '</span>';
    return '<img class="' + cls + '" loading="lazy" src="' + esc(lista[0]) + '"' +
      ' data-capas="' + esc(lista.join('|')) + '" data-capa-i="0"' +
      ' data-inicial="' + inicial + '" data-cls="' + cls + '"' +
      ' onerror="window.capaFalhou(this)" alt="@' + esc(g.perfil) + '">';
  }

  window.capaFalhou = function(img){
    var lista = (img.getAttribute('data-capas') || '').split('|').filter(Boolean);
    var i = parseInt(img.getAttribute('data-capa-i') || '0', 10) + 1;
    if(i < lista.length){
      img.setAttribute('data-capa-i', String(i));
      img.src = lista[i];
      return;
    }
    var cls = img.getAttribute('data-cls') || 'swiper-foto';
    var span = document.createElement('span');
    span.className = cls + ' ' + cls + '-vazia vazia';
    span.textContent = img.getAttribute('data-inicial') || '?';
    if(img.parentNode) img.parentNode.replaceChild(span, img);
  };

  // delta_views_fmt já vem com sinal ("+1"); não repetir o "+".
  function deltaViews(cr){
    var v = String(cr.delta_views_fmt || cr.delta_views);
    return v.charAt(0) === '+' ? v : '+' + v;
  }

  function capaDe(c){
    if(MODO === 'artifact') return c.image_b64 ? 'data:image/jpeg;base64,' + c.image_b64 : '';
    if(c.capa) return c.capa;
    // Índice compacto: o caminho da capa é montado a partir do perfil e do código.
    // Sem a flag também: na VPS a capa que falta é buscada sob demanda (servidor/capas-sob-demanda.js).
    return c.perfil && c.codigo ? 'perfis/' + c.perfil + '/videos/' + c.codigo + '/capa.jpg' : '';
  }

  function cartao(c){
    var src = capaDe(c);   // se o arquivo não existir, o tratador de erro de imagem esconde o quadro vazio
    var snippet = c.legenda ? esc(c.legenda.trim().replace(/\s+/g, ' ').slice(0, 95)) + (c.legenda.length > 95 ? '…' : '') : '';
    
    // Números vêm do índice compacto (c.v/c.l/c.k); formatação feita aqui.
    var met = c.metrics || {};
    var viewsVal = c.v ? fmtK(c.v) : '—';
    var likesVal = c.l ? fmtK(c.l) : null;
    var comsVal = c.k ? fmtK(c.k) : null;

    var pills = [];
    if(likesVal != null){
      pills.push('<span class="m-pill m-likes" title="Curtidas">' +
        '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> ' +
        esc(likesVal) + '</span>');
    }
    if(comsVal != null){
      pills.push('<span class="m-pill m-coms" title="Comentários">' +
        '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg> ' +
        esc(comsVal) + '</span>');
    }
    Object.keys(met).forEach(function(k){
      if(k === 'views' || k === 'likes' || k === 'curtidas' || k === 'comentários' || k === 'comentarios' || k === 'janela') return;
      var v = typeof met[k] === 'object' ? met[k].raw : met[k];
      pills.push('<span class="m-pill" title="' + esc(k) + '">' + esc(k) + ': ' + esc(v) + '</span>');
    });

    var dtExibicao = dataPublicacaoDe(c);
    if(dtExibicao){
      var dPassados = diasNoAr(c);
      var badgeTexto = '';
      if(dPassados !== null){
        var diasInt = Math.floor(dPassados);
        if(diasInt === 0) badgeTexto = 'Hoje';
        else if(diasInt === 1) badgeTexto = 'Ontem';
        else if(diasInt <= 60) badgeTexto = 'há ' + diasInt + ' dias';
        else badgeTexto = dtExibicao;
      } else {
        badgeTexto = dtExibicao;
      }
      pills.push('<span class="m-pill m-data" title="Publicado em ' + esc(dtExibicao) + '">' +
        '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' +
        esc(badgeTexto) + '</span>');
    }

    var nMapa = window.MESA_PERFIS_NICHOS || {};
    var nNome = nMapa[(c.perfil || '').toLowerCase()];
    if(nNome) pills.unshift('<span class="m-pill m-nicho" data-nicho="' + esc(nNome) + '" title="Filtrar criativos por ' + esc(nNome) + '">' + esc(nNome) + '</span>');

    var rotuloTipo = c.tipo ? esc(c.tipo.toUpperCase()) : (c.confidence != null ? c.confidence + '%' : 'REEL');

    var statusDl = c.status_download || 'PENDENTE';
    var statusClasse = statusDl === 'BAIXADO' ? 'st-baixado' : (statusDl === 'ERRO' ? 'st-erro' : 'st-pendente');
    var badgeStatus = '<span class="st-badge ' + statusClasse + '">' + (statusDl === 'BAIXADO' ? 'Baixado' : (statusDl === 'ERRO' ? 'Erro' : 'Pendente')) + '</span>';
    var badgeTop15 = c.top15 ? '<span class="st-top15">Top 15</span>' : '';
    var ganho = ganhoDe(c);
    var badgeCrescimento = ganho
      ? '<span class="badge-alta" title="Crescimento recente: +' + esc(fmtK(ganho)) + ' views">+' + esc(fmtK(ganho)) + '</span>'
      : '';

    return '<button class="cv" data-n="' + c.number + '" data-perfil="' + esc(c.perfil || '') + '">' +
      '<div class="quadro">' +
        (src ? '<img loading="lazy" src="' + esc(src) + '" alt="Primeiro frame do CV ' + c.number + '">' : '') +
        '<span class="id">CV ' + c.number + '</span>' +
        badgeTop15 +
        badgeStatus +
        (c.is_top ? '<span class="fogo">TOP</span>' : '') +
        (c.duration_s != null ? '<span class="dur">' + c.duration_s + 's</span>' : '') +
      '</div>' +
      '<div class="pe">' +
        (c.perfil ? '<div class="card-perfil" title="Filtrar por @' + esc(c.perfil) + '" data-filtrar-perfil="' + esc(c.perfil) + '">@' + esc(c.perfil) + '</div>' : '') +
        (snippet ? '<div class="card-snippet">' + snippet + '</div>' : '') +
        '<div class="marca-num"><b>' + esc(viewsVal) + '</b>' +
          '<span>' + esc(c.headline_metric_label || 'views') + '</span>' +
          badgeCrescimento + '</div>' +
        (pills.length ? '<div class="metricas-secundarias">' + pills.join('') + '</div>' : '') +
        '<div class="rodape-cv"><span class="cod-link">' + esc(c.codigo || c.language || '') + '</span>' +
          '<span>' + rotuloTipo + '</span></div>' +
      '</div></button>';
  }

  // ---- SWIPERS (métricas agregadas por perfil) --------------------------
  function numDe(c, chave){
    if(chave === 'views') return c.v || 0;
    if(chave === 'likes') return c.l || 0;
    if(chave === 'comentarios') return c.k || 0;
    return 0;
  }
  function mediana(arr){
    if(!arr.length) return 0;
    var s = arr.slice().sort(function(a,b){ return a - b; });
    var meio = Math.floor(s.length / 2);
    return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
  }
  function fmtInt(n){ return Math.round(n || 0).toLocaleString('pt-BR'); }
  function fmtPct(n){ return (n || 0).toFixed(2).replace('.', ',') + '%'; }
  function fmtK(n){
    n = n || 0;
    if(n >= 1000000000) return (n / 1000000000).toFixed(1).replace('.', ',') + 'B';
    if(n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + 'M';
    if(n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'k';
    return fmtInt(n);
  }

  function renderStatsGlobais(){
    var el = document.getElementById('stats-globais');
    if(!el) return;
    var totalCriativos = DADOS.length;
    var agregados = agregarPerfis();
    var totalPerfis = agregados.ordem.length;
    var viewsArr = DADOS.map(function(c){ return numDe(c, 'views'); });
    var volumeViews = viewsArr.reduce(function(a, b){ return a + b; }, 0);
    var totalLikes = DADOS.reduce(function(a, c){ return a + numDe(c, 'likes'); }, 0);
    var totalComentarios = DADOS.reduce(function(a, c){ return a + numDe(c, 'comentarios'); }, 0);
    // Média e mediana só com criativos que têm métrica capturada: os sem métrica
    // entrariam como 0 view e puxariam os números para baixo.
    var viewsMedidos = viewsArr.filter(function(v){ return v > 0; });
    var media = viewsMedidos.length ? viewsMedidos.reduce(function(a, b){ return a + b; }, 0) / viewsMedidos.length : 0;
    var med = mediana(viewsMedidos);
    var engajamento = volumeViews ? (totalLikes + totalComentarios) / volumeViews * 100 : 0;

    var totalSeguidores = 0, perfisSemSeguidores = 0;
    agregados.ordem.forEach(function(p){
      var g = agregados.mapa[p];
      if(g && typeof g.seguidores === 'number') totalSeguidores += g.seguidores;
      else perfisSemSeguidores++;
    });

    var itens = [
      ['Perfis', fmtInt(totalPerfis)],
      ['Seguidores', totalSeguidores ? fmtK(totalSeguidores) : '—', '', totalSeguidores && perfisSemSeguidores ? perfisSemSeguidores + ' sem dado' : ''],
      ['Criativos', fmtInt(totalCriativos)],
      ['Views', fmtK(volumeViews)],
      ['Curtidas', fmtK(totalLikes)],
      ['Comentários', fmtK(totalComentarios)],
      ['Média por vídeo', fmtK(media), 'views'],
      ['Mediana de views', fmtK(med), 'views'],
      ['Engajamento', fmtPct(engajamento)]
    ];
    el.innerHTML = itens.map(function(it){
      return '<div class="stat-card"><span class="stat-label">' + esc(it[0]) + '</span>' +
        '<span class="stat-valor">' + it[1] +
        (it[2] ? '<span class="stat-nota"> ' + esc(it[2]) + '</span>' : '') +
        '</span>' +
        (it[3] ? '<span class="stat-obs">' + esc(it[3]) + '</span>' : '') +
        '</div>';
    }).join('');
  }

  var qPendentes = document.getElementById('q-pendentes');
  function renderPendentes(){
    var elLista = document.getElementById('pendentes-lista');
    var elTotal = document.getElementById('pendentes-total');
    if(!elLista) return;
    var coletados = {};
    DADOS.forEach(function(c){ if(c.perfil) coletados[c.perfil.toLowerCase()] = true; });
    var termo = qPendentes ? qPendentes.value.trim().toLowerCase() : '';
    var lista = PENDENTES.filter(function(p){ return !coletados[p.toLowerCase()]; });
    if(termo) lista = lista.filter(function(p){ return p.toLowerCase().indexOf(termo) !== -1; });
    if(elTotal) elTotal.textContent = lista.length;
    elLista.innerHTML = lista.length
      ? lista.map(function(p){
          return '<a class="pendente-chip" href="https://www.instagram.com/' + esc(p) + '/" target="_blank" rel="noopener noreferrer">@' + esc(p) + '</a>';
        }).join('')
      : '<span class="pendentes-vazio">Nenhum pendente por aqui — tudo coletado.</span>';
  }
  if(qPendentes) qPendentes.addEventListener('input', renderPendentes);

  var ordemPerfisSel = document.getElementById('ordem-perfis');
  var mapaPerfisCache = null;

  function agregarPerfis(){
    if(mapaPerfisCache) return mapaPerfisCache;
    var mapa = {}, ordemPerfis = [];
    var metaPorChave = {};
    Object.keys(PERFIS_META).forEach(function(p){ metaPorChave[p.toLowerCase()] = PERFIS_META[p]; });
    var conhecidos = perfisUi
      ? perfisUi.perfisConhecidos(DADOS, PERFIS_META)
      : Object.keys(PERFIS_META);
    conhecidos.forEach(function(p){
      var meta = PERFIS_META[p] || metaPorChave[p.toLowerCase()] || {};
      mapa[p] = {perfil:p, criativos:0, views:0, likes:0, comentarios:0, capa:'', capas:[], topViews:-1, topNumero:null, baixados:0, pendentes:0,
        seguidores: (typeof meta.seguidores === 'number' ? meta.seguidores : null),
        fotoPerfilUrl: meta.foto || '',
        nomeExibicao: meta.nome_exibicao || '',
        sobreAConta: meta.sobre_a_conta || null};
      ordemPerfis.push(p);
    });
    DADOS.forEach(function(c){
      var p = c.perfil || '';
      if(!p) return;
      if(!mapa[p]){
        var meta = PERFIS_META[p] || metaPorChave[p.toLowerCase()] || {};
        mapa[p] = {perfil:p, criativos:0, views:0, likes:0, comentarios:0, capa:'', capas:[], topViews:-1, topNumero:null, baixados:0, pendentes:0,
          seguidores: (typeof meta.seguidores === 'number' ? meta.seguidores : null),
          fotoPerfilUrl: meta.foto || '',
          nomeExibicao: meta.nome_exibicao || '',
          sobreAConta: meta.sobre_a_conta || null};
        ordemPerfis.push(p);
      }
      var g = mapa[p];
      var v = numDe(c, 'views');
      g.criativos++;
      if(c.status_download === 'BAIXADO') g.baixados++;
      else g.pendentes++;
      g.views += v;
      g.likes += numDe(c, 'likes');
      g.comentarios += numDe(c, 'comentarios');
      if(g.capas.length < MAX_CAPAS_PERFIL){
        var src = capaDe(c);
        // guarda varias candidatas: a capa do primeiro criativo pode ainda nao
        // ter sido baixada, e ai a foto do swiper sai quebrada sem necessidade
        if(src && g.capas.indexOf(src) === -1){
          g.capas.push(src);
          if(!g.capa) g.capa = src;
        }
      }
      if(v > g.topViews){ g.topViews = v; g.topNumero = c.number; }
    });
    mapaPerfisCache = {mapa:mapa, ordem:ordemPerfis};
    return mapaPerfisCache;
  }

  function renderPerfilCabecalho(){
    if(!perfilCabecalho) return;
    var p = selPerfil ? selPerfil.value : '';
    if(!p && q && q.value.trim().startsWith('@')){
      var direto = normalizar(q.value.trim().replace(/^@+/, '')).trim().toLowerCase();
      var agPerfis = agregarPerfis();
      if(agPerfis.mapa[direto]) p = direto;
    }
    if(!p){ perfilCabecalho.hidden = true; perfilCabecalho.innerHTML = ''; return; }
    var g = agregarPerfis().mapa[p];
    if(!g){ perfilCabecalho.hidden = true; perfilCabecalho.innerHTML = ''; return; }
    var eng = g.views ? (g.likes + g.comentarios) / g.views * 100 : 0;
    var inicial = esc((g.perfil[0] || '?').toUpperCase());
    perfilCabecalho.hidden = false;
    perfilCabecalho.innerHTML =
      '<button class="perfil-voltar" onclick="mostrarAba(\'swipers\')">← Swipers</button>' +
      fotoPerfil(g, 'perfil-foto-grande', inicial) +
      '<div class="perfil-info">' +
        '<span class="perfil-nome">@' + esc(g.perfil) + '</span>' +
        '<span class="perfil-qtd">' + (g.criativos
          ? g.criativos + ' criativo' + (g.criativos !== 1 ? 's' : '') + ' · <b style="color:var(--pos, #5fd0c0)">' + g.baixados + ' baixados</b> · <b style="color:var(--warn, #e3b341)">' + g.pendentes + ' pendentes</b>'
          : '<b style="color:var(--warn, #e3b341)">dados de criativos pendentes</b>') + '</span>' +
      '</div>' +
      '<div class="perfil-metricas">' +
        '<span class="m-pill" title="Volume de views">views ' + fmtK(g.views) + '</span>' +
        '<span class="m-pill m-likes" title="Curtidas">likes ' + fmtK(g.likes) + '</span>' +
        '<span class="m-pill m-coms" title="Comentários">comentários ' + fmtK(g.comentarios) + '</span>' +
        '<span class="m-pill" title="Taxa de engajamento">engajamento ' + fmtPct(eng) + '</span>' +
      '</div>' +
      '<button class="bt btn-sync-perfil-header" onclick="window.abrirModalSyncCustom(\'' + esc(g.perfil) + '\')" title="Sincronizar @' + esc(g.perfil) + ' agora" style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:rgba(0,240,255,0.12);border:1px solid rgba(0,240,255,0.4);color:#00F0FF;font-weight:600;font-size:12px;padding:7px 14px;border-radius:6px;cursor:pointer;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Sincronizar @' + esc(g.perfil) + '</button>';
  }

  function renderPerfis(){
    var el = document.getElementById('grade-perfis');
    if(!el) return;
    var ag = agregarPerfis();
    var mapa = ag.mapa, ordemPerfis = ag.ordem;

    var modo = ordemPerfisSel ? ordemPerfisSel.value : 'views';
    var perfilAtivo = selPerfil ? selPerfil.value.toLowerCase() : '';
    var termoPerfil = qSwipers ? qSwipers.value.trim().toLowerCase().replace(/^@/, '') : '';
    var nichoSwiperFiltro = selNichoSwipers ? selNichoSwipers.value : '';
    var nichosMapa = window.MESA_PERFIS_NICHOS || {};
    var perfisArr = ordemPerfis.map(function(p){ return mapa[p]; }).filter(function(g){
      if(nichoSwiperFiltro && (nichosMapa[(g.perfil || '').toLowerCase()] || '🌐 Geral / Outros') !== nichoSwiperFiltro) return false;
      return !termoPerfil || (g.perfil || '').toLowerCase().indexOf(termoPerfil) !== -1;
    }).sort(function(a, b){
      if(modo === 'seguidores') return (b.seguidores || 0) - (a.seguidores || 0);
      if(modo === 'alcance'){
        // views por seguidor: revela a conta pequena que entrega mais que o tamanho dela
        var rA = a.seguidores ? a.views / a.seguidores : 0;
        var rB = b.seguidores ? b.views / b.seguidores : 0;
        return rB - rA;
      }
      if(modo === 'likes') return b.likes - a.likes;
      if(modo === 'criativos') return b.criativos - a.criativos;
      if(modo === 'engajamento'){
        var eA = a.views ? (a.likes + a.comentarios) / a.views : 0;
        var eB = b.views ? (b.likes + b.comentarios) / b.views : 0;
        return eB - eA;
      }
      return b.views - a.views;
    });

    el.innerHTML = perfisArr.map(function(g){
      var eng = g.views ? (g.likes + g.comentarios) / g.views * 100 : 0;
      var eficiencia = g.criativos ? g.views / g.criativos : 0;
      var inicial = esc((g.perfil[0] || '?').toUpperCase());
      var ativo = perfilAtivo && g.perfil.toLowerCase() === perfilAtivo ? ' ativo' : '';
            var sNicho = nichosMapa[(g.perfil || '').toLowerCase()] || '🌐 Geral / Outros';
            return '<button class="swiper-card' + ativo + '" data-filtrar-perfil="' + esc(g.perfil) + '" ' +
              'title="Filtrar por @' + esc(g.perfil) + '">' +
              '<div class="swiper-topo">' +
                fotoPerfil(g, 'swiper-foto', inicial) +
                '<div class="swiper-id">' +
                  '<span class="swiper-nome">@' + esc(g.perfil) + '</span>' +
                  '<span class="swiper-nicho-tag" data-nicho="' + esc(sNicho) + '" title="Filtrar criativos por ' + esc(sNicho) + '">' + esc(sNicho) + '</span>' +
            '<span class="swiper-qtd">' + (g.criativos
              ? '<span>' + g.criativos + ' criativo' + (g.criativos !== 1 ? 's' : '') + '</span> · <span class="ok">' + g.baixados + ' baixados</span> · <span class="pend">' + g.pendentes + ' pendentes</span>'
              : '<span class="pend">dados de criativos pendentes</span>') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="swiper-destaque">' +
          '<b title="Volume de views">' + fmtK(g.views) + '</b><span class="unid">views</span>' +
          '<span class="swiper-eng" title="Taxa de engajamento">' + fmtPct(eng) + ' <small>eng</small></span>' +
        '</div>' +
        '<div class="swiper-metricas">' +
          '<div class="mt mt-likes" title="Curtidas"><span class="mt-k">likes</span><span class="mt-v">' + fmtK(g.likes) + '</span></div>' +
          '<div class="mt mt-coms" title="Comentários"><span class="mt-k">coment.</span><span class="mt-v">' + fmtK(g.comentarios) + '</span></div>' +
          '<div class="mt" title="Views por criativo (eficiência)"><span class="mt-k">views/cv</span><span class="mt-v">' + fmtK(eficiencia) + '</span></div>' +
          (g.seguidores != null
            ? '<div class="mt" title="Seguidores do perfil"><span class="mt-k">seguidores</span><span class="mt-v">' + fmtK(g.seguidores) + '</span></div>' +
              '<div class="mt" title="Views acumuladas por seguidor — quanto o perfil entrega além do próprio tamanho"><span class="mt-k">alcance</span><span class="mt-v">' + (g.seguidores > 0 ? (g.views / g.seguidores).toFixed(1).replace('.', ',') + '×' : '—') + '</span></div>'
            : '<div class="mt mt-vazia" title="Seguidores ainda não capturados: abra o perfil no Instagram e sincronize"><span class="mt-k">seguidores</span><span class="mt-v">—</span></div>' +
              '<div class="mt mt-vazia" title="Depende dos seguidores: sincronize o perfil para calcular"><span class="mt-k">alcance</span><span class="mt-v">-</span></div>') +
          (g.sobreAConta && g.sobreAConta.data_adesao ? '<div class="mt" title="Membro desde"><span class="mt-k">adesão</span><span class="mt-v">' + esc(g.sobreAConta.data_adesao) + '</span></div>' : '') +
          (g.sobreAConta && g.sobreAConta.localizacao ? '<div class="mt" title="Localização da Conta"><span class="mt-k">país</span><span class="mt-v">' + esc(g.sobreAConta.localizacao) + '</span></div>' : '') +
        '</div>' +
        (g.topNumero != null ? '<div class="swiper-top">Top: CV ' + g.topNumero + ' · <b>' + fmtK(g.topViews) + ' views</b></div>' : '') +
      '</button>';
    }).join('');
  }

  renderStatsGlobais();
  renderPendentes();
  if(ordemPerfisSel) ordemPerfisSel.addEventListener('change', renderPerfis);
  // Perfil vai em data-*, não em onclick inline: esc() protege HTML, não string de JS.
  var gradePerfis = document.getElementById('grade-perfis');
  if(gradePerfis) gradePerfis.addEventListener('click', function(e){
    var tagNicho = e.target.closest ? e.target.closest('.swiper-nicho-tag') : null;
    if(tagNicho){
      e.stopPropagation();
      e.preventDefault();
      var n = tagNicho.getAttribute('data-nicho') || tagNicho.textContent.trim();
      window.filtrarPorNicho(n, true);
      return;
    }
    var b = e.target.closest('.swiper-card');
    if(b) window.filtrarPorPerfil(b.getAttribute('data-filtrar-perfil'));
  });

  function desenhar(reset){
    if(reset) {
      pagina = 0;
      grade.innerHTML = lista.slice(0, PASSO).map(cartao).join('') || '<p class="vazio">' + (meuSwipe ? 'Nenhum favorito nesta seleção. Abra uma ficha na Biblioteca e clique em Salvar no meu swipe.' : 'Nenhum criativo para essa busca.') + '</p>';
    } else {
      grade.insertAdjacentHTML('beforeend', lista.slice(pagina * PASSO, (pagina + 1) * PASSO).map(cartao).join(''));
    }

    var paginas = Math.max(1, Math.ceil(lista.length / PASSO));
    if (pagina + 1 < paginas) {
      sentinela.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--dim);">↓ Carregando mais...</div>';
      if (!window.scrollObserver) {
        window.scrollObserver = new IntersectionObserver(function(entries) {
          if (entries[0].isIntersecting) {
            var pgs = Math.ceil(lista.length / PASSO);
            if (pagina + 1 < pgs) {
              pagina++;
              desenhar(false);
            }
          }
        }, { rootMargin: '400px' });
      }
      // Re-observar força uma nova checagem: se o sentinela continuar visível depois
      // de 48 cards (tela alta, zoom baixo), a próxima página carrega mesmo assim.
      window.scrollObserver.unobserve(sentinela);
      window.scrollObserver.observe(sentinela);
    } else {
      sentinela.innerHTML = '';
      if (window.scrollObserver) window.scrollObserver.disconnect();
    }
  }

  // Busca: minúsculas + sem acento, para casar transcrição/legenda de qualquer idioma.
  function normalizar(txt){
    txt = (txt || '').toLowerCase();
    if(txt.normalize) txt = txt.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return txt.replace(/\s+/g, ' ');
  }

  // O blob normalizado é caro (65k registros); calcula uma vez e guarda no próprio registro.
  // O marcador interno "[não traduzido]" sai do índice, e o texto bruto é liberado da memória.
  function blobBusca(c){
    if(c._blobN === undefined){
      var p = (c.perfil || '').toLowerCase();
      c._blobN = normalizar(c.search_blob).replace(/\[nao traduzido\]/g, ' ') + ' @' + p + ' ' + p + ' cv ' + c.number;
      delete c.search_blob;
    }
    return c._blobN;
  }

  // "frase entre aspas" casa literal; palavras soltas casam todas (E), em qualquer ordem.
  // "cv 12" (ou "cv12") filtra pelo número exato do criativo.
  function termosBusca(bruto){
    var termos = [], numero = null, re = /"([^"]+)"|(\S+)/g, m;
    while((m = re.exec(bruto)) !== null){
      var t = normalizar(m[1] || m[2].replace(/"/g, '')).trim();
      if(!t) continue;
      var cv = t.match(/^cv\s*(\d+)$/);
      if(cv){ numero = parseInt(cv[1], 10); continue; }
      if(!m[1] && /^\d+$/.test(t) && termos[termos.length - 1] === 'cv'){ termos.pop(); numero = parseInt(t, 10); continue; }
      termos.push(t);
    }
    return {termos: termos, numero: numero};
  }

  // Capa gravada em disco pelo build (caminho local, não link do Instagram).
  function temCapaLocal(c){
    if(c.temCapa != null) return !!c.temCapa;
    if(c.tem_capa != null) return !!c.tem_capa;
    var src = capaDe(c);
    return !!src && !/^(https?:|data:)/i.test(src);
  }

  // Ganho recente de views: vem do índice compacto (c.ganho) ou da ficha já carregada.
  function ganhoDe(c){
    if(c.crescimento && c.crescimento.delta_views > 0) return c.crescimento.delta_views;
    return c.ganho || 0;
  }

  // Decodificador matemático de Shortcode do Instagram para timestamp exato
  var ALPHABET_IG = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function shortcodeToDate(sc){
    if(!sc || typeof sc !== 'string') return null;
    try {
      var mid = 0n;
      for(var i = 0; i < sc.length; i++){
        var idx = ALPHABET_IG.indexOf(sc[i]);
        if(idx === -1) return null;
        mid = mid * 64n + BigInt(idx);
      }
      var ms = Number((mid >> 23n) + 1314220021721n);
      var d = new Date(ms);
      if(!isNaN(d.getTime()) && d.getFullYear() >= 2012 && d.getTime() <= Date.now() + 864e5) return d;
      return null;
    } catch(e){
      return null;
    }
  }

  function getRealDate(c){
    var tPub = c.data_publicacao ? Date.parse(c.data_publicacao) : NaN;
    var tCap = c.capturado_em ? Date.parse(c.capturado_em) : NaN;
    
    // Se a data de publicação for posterior à data em que o vídeo foi capturado, é cronologicamente impossível
    if(!isNaN(tPub) && !isNaN(tCap) && tPub > tCap + 3600000){
      var scDate = shortcodeToDate(c.codigo);
      if(scDate) return scDate;
    }
    if(!isNaN(tPub)){
      return new Date(tPub);
    }
    var scD = shortcodeToDate(c.codigo);
    if(scD) return scD;
    if(c.dias != null && c.dias >= 0){
      return new Date(Date.UTC(2020, 0, 1) + c.dias * 864e5);
    }
    return null;
  }

  // Dias desde a publicação (o índice guarda dias desde 2020-01-01).
  var HOJE_DIAS = Math.floor((Date.now() - Date.UTC(2020, 0, 1)) / 864e5);
  function diasNoAr(c){
    var d = getRealDate(c);
    if(d) return Math.max(0, (Date.now() - d.getTime()) / 864e5);
    return null;
  }

  function diaRelativo(c){
    var d = getRealDate(c);
    if(d) return (d.getTime() - Date.UTC(2020, 0, 1)) / 864e5;
    return -1;
  }

  function dataPublicacaoDe(c){
    var d = getRealDate(c);
    if(d) return d.toLocaleDateString('pt-BR');
    return '';
  }

  // Critérios de ordenação. Devolve negativo quando "a" vem antes de "b".
  function compararPor(modo, a, b){
    switch(modo){
      case 'metrica':      return (b.v || 0) - (a.v || 0);
      case 'likes':        return (b.l || 0) - (a.l || 0);
      case 'comentarios':  return (b.k || 0) - (a.k || 0);
      case 'likes_views':  return razao(b, 'l') - razao(a, 'l');
      case 'comentarios_views': return razao(b, 'k') - razao(a, 'k');
      case 'engajamento':  return (razao(b, 'l') + razao(b, 'k')) - (razao(a, 'l') + razao(a, 'k'));
      case 'duracao':      return (a.duration_s || 1e9) - (b.duration_s || 1e9);
      case 'recente': {
        var dA = diaRelativo(a);
        var dB = diaRelativo(b);
        if(dB !== dA) return dB - dA;
        return (b.v || 0) - (a.v || 0);
      }
      case 'antigo': {
        var dA = diaRelativo(a);
        var dB = diaRelativo(b);
        var vA = dA < 0 ? 1e9 : dA;
        var vB = dB < 0 ? 1e9 : dB;
        if(vA !== vB) return vA - vB;
        return (a.v || 0) - (b.v || 0);
      }
      case 'tracao':       return ganhoDe(b) - ganhoDe(a);
      case 'views_dia':    return viewsPorDia(b) - viewsPorDia(a);
      case 'numero':       return 0;   // cai no desempate padrão (perfil + número)
      default:             return 0;
    }
  }
  function razao(c, campo){ return c.v > 0 ? (c[campo] || 0) / c.v : 0; }
  function viewsPorDia(c){ var d = diasNoAr(c); return d && d > 0 ? (c.v || 0) / d : (c.v || 0); }

  var fichaAberta = null;   // registro exibido na ficha, para reencontrá-lo se a lista mudar
  var focoAntesFicha = null;

  function filtrar(){
    var qBruto = q ? q.value.trim() : '';
    var ehBuscaPerfil = qBruto.startsWith('@');
    var perfilBuscaDireto = ehBuscaPerfil ? normalizar(qBruto.replace(/^@+/, '')).trim().toLowerCase() : '';

    var busca = termosBusca(qBruto), termos = busca.termos, numeroBusca = busca.numero;
    if(termos.length && !buscaPronta){ prepararBusca(); }
    if(ehBuscaPerfil && perfilBuscaDireto && perfisUnicos.indexOf(perfilBuscaDireto) !== -1){
      if(selPerfil && selPerfil.value !== perfilBuscaDireto) selPerfil.value = perfilBuscaDireto;
    }
    var perfilFiltro = (!ehBuscaPerfil && selPerfil) ? selPerfil.value.toLowerCase() : '';
    var statusFiltro = selStatus ? selStatus.value : '';
    var viewsMin = selViews ? (parseInt(selViews.value, 10) || 0) : 0;
    var diasMax = selPeriodo && selPeriodo.value ? parseInt(selPeriodo.value, 10) * (/h$/.test(selPeriodo.value) ? 1 / 24 : 1) : 0;
    var nichoFiltro = selNicho ? selNicho.value : '';
    var nichosMapa = window.MESA_PERFIS_NICHOS || {};
    lista = DADOS.filter(function(c){
      var perfilLower = (c.perfil || '').toLowerCase();
      if(ehBuscaPerfil){
        if(!perfilLower || perfilLower.indexOf(perfilBuscaDireto) === -1) return false;
      }
      var bateTexto = true;
      if(!ehBuscaPerfil && termos.length){
        var blob = buscaPronta ? blobBusca(c) : ('@' + perfilLower + ' ' + perfilLower + ' cv ' + c.number);
        for(var i = 0; i < termos.length; i++){
          var t = termos[i];
          var tClean = t.replace(/^@/, '');
          if(blob.indexOf(t) === -1 && blob.indexOf(tClean) === -1 && perfilLower.indexOf(tClean) === -1){
            bateTexto = false;
            break;
          }
        }
      }
      var cNicho = nichosMapa[perfilLower] || '🌐 Geral / Outros';
      var bateNicho = !nichoFiltro || (cNicho === nichoFiltro);
      if(!bateNicho) return false;
      var batePerfil = !perfilFiltro || (perfilLower === perfilFiltro);
      var bateStatus = true;
      if(statusFiltro === 'TOP15'){
        bateStatus = !!c.top15;
      } else if(statusFiltro === 'COM_CAPA'){
        bateStatus = temCapaLocal(c);       // arquivo de capa presente em disco
      } else if(statusFiltro === 'PENDENTE'){
        bateStatus = c.status_download !== 'BAIXADO';   // mesma regra da contagem por perfil (inclui ERRO)
      } else if(statusFiltro){
        bateStatus = (c.status_download || 'PENDENTE') === statusFiltro;
      }
      var bateViews = !viewsMin || (c.v || 0) >= viewsMin;
      var batePeriodo = true;
      if(diasMax){ var d = diasNoAr(c); batePeriodo = d !== null && d <= diasMax; }
      return bateTexto && batePerfil && bateStatus && bateViews && batePeriodo &&
             (!meuSwipe || favoritos.has(identidade(c))) &&
             (!modoDia || DIA_SET.has(c.codigo));
    });
    if(modoDia){
      lista.sort(function(a, b){ return (DIA_RANK[a.codigo] - DIA_RANK[b.codigo]); });
    } else {
      var modo = ordem.value, modo2 = ordem2 ? ordem2.value : '';
      lista.sort(function(a, b){
        return compararPor(modo, a, b) || (modo2 ? compararPor(modo2, a, b) : 0) ||
               ((a.perfil || '').localeCompare(b.perfil || '') || (a.number - b.number));
      });
    }
    conta.textContent = lista.length;
    desenhar(true);
    renderPerfilCabecalho();
    // A grade de Swipers tem ~30 MB de HTML: só redesenha se estiver à vista
    // (mostrarAba('swipers') redesenha ao abrir a aba).
    if(!secaoSwipers.hidden) renderPerfis();
    // Ficha aberta: reencontra o criativo na lista nova para ←/→ e frames seguirem certos.
    if(fichaAberta && atual >= 0){
      atual = lista.indexOf(fichaAberta);
      if(atual < 0){ fechar(); return; }
      var btAnt = document.getElementById('ant'), btProx = document.getElementById('prox');
      if(btAnt) btAnt.disabled = atual === 0;
      if(btProx) btProx.disabled = atual === lista.length - 1;
    }
  }

  // ---- detalhe -----------------------------------------------------------
  var ESTILO_IFRAME_IG = 'width:100%; height:100%; border:none; background:var(--bg-raised, #000);';

  // Embed oficial do Instagram: capa + "Tocar Vídeo"; o clique troca pelo iframe (ligarPlayer).
  function playerInstagram(c){
    var emb = embedDoInstagram(c);
    if(!emb) return '';
    var src = capaDe(c);
    var igUrl = c.url || ('https://www.instagram.com/p/' + (c.codigo || c.id) + '/');
    if (src) {
      return '<div class="ig-player-wrapper" data-embed="' + esc(emb) + '" data-ig-url="' + esc(igUrl) + '" style="position:relative;width:100%;height:100%;background:var(--bg-raised, #000);display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
               '<div class="ig-direct-bar" style="position:absolute;top:10px;right:10px;z-index:5;">' +
                 '<a href="' + esc(igUrl) + '" target="_blank" rel="noopener noreferrer" class="tag-ig" style="background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:5px 10px;border-radius:6px;font-size:12px;text-decoration:none;display:flex;align-items:center;gap:5px;">' +
                   '<span>Assistir no Instagram</span> ↗' +
                 '</a>' +
               '</div>' +
               '<img class="ig-capa" src="' + esc(src) + '" style="width:100%;height:calc(100% - 50px);object-fit:cover;cursor:pointer;" alt="Capa do video">' +
               '<div style="height:50px;width:100%;display:flex;align-items:center;justify-content:center;background:var(--raised);gap:12px;">' +
                 '<button class="tag-ig ig-tocar" style="cursor:pointer;border:none;font-family:inherit;font-size:inherit;">' +
                   'Reproduzir vídeo' +
                 '</button>' +
               '</div>' +
             '</div>';
    }
    return '<iframe class="ig" src="' + esc(emb) + '" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen scrolling="no" style="' + ESTILO_IFRAME_IG + '"></iframe>';
  }

  function player(c){
    // Vídeo já baixado toca do disco; se o arquivo faltar, ligarPlayer cai no embed.
    if(MODO === 'local' && c.video && c.status_download === 'BAIXADO'){
      return '<video controls preload="metadata" playsinline ' +
             (c.capa ? 'poster="' + esc(c.capa) + '"' : '') +
             '><source src="' + esc(c.video) + '"></video>';
    }
    var ig = playerInstagram(c);
    if(ig) return ig;
    if(c.drive_id){
      return '<iframe id="quadro-video" src="https://drive.google.com/file/d/' +
             esc(c.drive_id) + '/preview" allow="autoplay" allowfullscreen></iframe>';
    }
    return playerIndisponivel(c);
  }

  function playerIndisponivel(c){
    var src = capaDe(c);
    return (src ? '<img src="' + esc(src) + '" alt="">' : '') +
      '<div class="recado recado-sobre-capa" style="position:absolute;inset:0">' +
        '<span class="recado-aviso">Mídia indisponível</span>' +
      '</div>';
  }

  function ligarPlayer(caixa, c){
    if(!caixa) return;
    var fonte = caixa.querySelector('video source');
    if(fonte){
      fonte.addEventListener('error', function(){
        if(!caixa.isConnected) return;
        caixa.innerHTML = playerInstagram(c) || playerIndisponivel(c);
        ligarPlayer(caixa, c);
      });
    }
    var wrapper = caixa.querySelector('.ig-player-wrapper');
    if(wrapper){
      wrapper.addEventListener('click', function(e){
        if(e.target.closest('.ig-direct-bar')) return;
        if(!e.target.closest('.ig-capa, .ig-tocar')) return;
        var igUrl = wrapper.getAttribute('data-ig-url') || c.url || ('https://www.instagram.com/p/' + (c.codigo || c.id) + '/');
        var quadro = document.createElement('iframe');
        quadro.className = 'ig';
        quadro.src = wrapper.getAttribute('data-embed');
        quadro.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
        quadro.setAttribute('allowfullscreen', '');
        quadro.setAttribute('scrolling', 'no');
        quadro.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        quadro.setAttribute('style', ESTILO_IFRAME_IG);

        var barraTopo = document.createElement('div');
        barraTopo.style.cssText = 'position:absolute;top:6px;right:6px;z-index:20;';
        barraTopo.innerHTML = '<a href="' + esc(igUrl) + '" target="_blank" rel="noopener noreferrer" class="tag-ig" style="background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);color:#fff;border:1px solid rgba(255,255,255,0.25);padding:4px 8px;border-radius:5px;font-size:11px;text-decoration:none;">Assistir direto no Instagram ↗</a>';

        var barraRodape = document.createElement('div');
        barraRodape.style.cssText = 'position:absolute;bottom:6px;left:6px;right:6px;z-index:20;display:flex;justify-content:space-between;align-items:center;background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.18);padding:6px 12px;border-radius:6px;font-size:11.5px;color:#CBD5E1;';
        barraRodape.innerHTML = '<span>⚠️ Vídeo indisponível ou bloqueado no embed?</span>' +
          '<div style="display:flex;gap:6px;">' +
            '<a href="' + esc(igUrl) + '" target="_blank" rel="noopener noreferrer" class="tag-ig" style="background:#2563EB;color:#fff;padding:4px 9px;border-radius:4px;text-decoration:none;font-weight:600;font-size:11px;">Abrir no Instagram ↗</a>' +
            (c.codigo ? '<button type="button" onclick="window.marcarComoRemovido(\'' + esc(c.codigo) + '\')" style="background:rgba(239,68,68,0.25);border:1px solid #EF4444;color:#EF4444;padding:4px 9px;border-radius:4px;cursor:pointer;font-weight:700;font-size:11px;">🗑️ Excluir Post</button>' : '') +
          '</div>';

        wrapper.innerHTML = '';
        wrapper.appendChild(barraTopo);
        wrapper.appendChild(barraRodape);
        wrapper.appendChild(quadro);
      });
    }
  }

  // Embed oficial: o endpoint /p/{cod}/embed/captioned/ é o oficial suportado para fotos, carrosséis e reels.
  function embedDoInstagram(c){
    var cod = c.codigo || c.id;
    if(!cod) return '';
    return 'https://www.instagram.com/p/' + encodeURIComponent(cod) + '/embed/captioned/';
  }

  function dado(k, v){
    return v ? '<div class="dado"><div class="k">' + esc(k) + '</div>' +
               '<div class="v">' + esc(v) + '</div></div>' : '';
  }

  function formatarData(iso){
    if(!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    } catch(e) { return iso; }
  }

  window.baixarOnDemand = function(url, btn) {
    if(!url) return;
    var textoOriginal = btn.innerHTML;
    
    function abrirAba() {
      btn.innerHTML = 'Abrindo aba...';
      setTimeout(function(){
        var aba = window.open('https://cobalt.tools/', '_blank');
        btn.innerHTML = textoOriginal;
        // Fora do clique (depois do alerta) o bloqueador de pop-up pode barrar a aba.
        if(!aba) prompt('O navegador bloqueou a nova aba. Abra este endereço:', 'https://cobalt.tools/');
      }, 1000);
    }

    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function() {
        alert('O link do Instagram foi COPIADO!\n\nNa próxima tela (Cobalt), basta colar (Ctrl+V) o link na barra e dar Enter para baixar.');
        abrirAba();
      }).catch(function() {
        prompt('O seu navegador bloqueou a cópia automática. Copie o link abaixo (Ctrl+C) e cole no Cobalt:', url);
        abrirAba();
      });
    } else {
      var input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      var copiou = false;
      try { copiou = document.execCommand('copy'); } catch(err) {}
      document.body.removeChild(input);
      // execCommand devolve false (sem exceção) quando não copia.
      if(copiou) alert('O link do Instagram foi COPIADO!\n\nNa próxima tela (Cobalt), basta colar (Ctrl+V) o link na barra e dar Enter para baixar.');
      else prompt('O seu navegador bloqueou a cópia automática. Copie o link abaixo (Ctrl+C) e cole no Cobalt:', url);
      abrirAba();
    }
  };

  window.marcarComoRemovido = async function(codigo){
    if(!codigo) return;
    if(!confirm('Deseja realmente remover o criativo ' + codigo + ' do catálogo?\n\nEle será excluído das buscas e listagens permanentemente.')) return;

    try {
      var res = await fetch('/api/creatives/' + encodeURIComponent(codigo) + '/remover', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
      });
      if(!res.ok) throw new Error('HTTP ' + res.status);
    } catch(err) {
      console.warn('Erro ao salvar remoção no servidor:', err);
    }

    // Atualiza imediatamente na memória local do cliente
    if(!AJUSTES) AJUSTES = {versao: 1, criativos: {}, editados: {}, perfis: {}, removidos: [], perfis_ocultos: [], pendentes: []};
    if(!AJUSTES.removidos) AJUSTES.removidos = [];
    if(AJUSTES.removidos.indexOf(codigo) === -1) AJUSTES.removidos.push(codigo);

    // Remove de DADOS
    var idx = DADOS.findIndex(function(x){ return x.codigo === codigo; });
    if(idx !== -1) DADOS.splice(idx, 1);

    fechar();
    filtrar();
    alert('Criativo ' + codigo + ' removido do catálogo com sucesso!');
  };

  function montarTrilhoMetasHtml(c){
    var pinos = Object.keys(c.metrics || {}).map(function(k){
      var m = c.metrics[k];
      var quente = k === c.headline_metric_label ? ' quente' : '';
      return '<span class="pino' + quente + '">' + esc(k) + ' ' +
             esc(typeof m === 'object' ? m.raw : m) + '</span>';
    }).join('');

    return (pinos ? '<div class="fichas-metrica">' + pinos + '</div>' : '') +
      (c.status_download ? dado('Status do Vídeo', c.status_download === 'BAIXADO' ? 'Baixado (vídeo local)' : (c.status_download === 'ERRO' ? (c.top15 ? 'Top 15 · erro no download' : 'Erro no download') : (c.top15 ? 'Top 15 · pendente de download' : 'Pendente de download'))) : '') +
      (c.perfil ? '<div class="dado"><div class="k">Perfil do Instagram</div><div class="v">' +
        '<a class="tag-ig" href="https://www.instagram.com/' + esc(encodeURIComponent(c.perfil)) + '/" target="_blank" rel="noopener">@' +
                 esc(c.perfil) + ' ↗</a>' + '</div></div>' : '') +
      (c.codigo ? dado('Shortcode', c.codigo) : '') +
      (c.tipo ? dado('Tipo', c.tipo.toUpperCase()) : '') +
      (c.capturado_em ? dado('Capturado em', formatarData(c.capturado_em)) : '') +
      (dataPublicacaoDe(c) ? dado('Data da Publicação', dataPublicacaoDe(c)) : '') +
      (c.origem ? dado('Origem da Coleta', c.origem === 'grade' ? 'Grade do Perfil' : c.origem) : '') +
      dado('Arquivo de Vídeo', c.filename) +
      (c.janela ? dado('Janela', c.janela) : '') +
      (c.drive_id ? '<div class="dado"><div class="k">Drive</div><div class="v">' +
        '<a href="https://drive.google.com/file/d/' + esc(c.drive_id) +
        '/view" target="_blank" rel="noopener">Abrir original ↗</a></div></div>' : '');
  }

  function montarLaudoHtml(c, aguardandoLote){
    var html = '';
    if(aguardandoLote){
      html += '<div id="status-carga-lote" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface);border:1px solid var(--line);border-radius:6px;margin-bottom:12px;font-size:12px;color:var(--dim);">' +
        '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent);animation:girar-lote 0.8s linear infinite;"></span>' +
        '<span>Carregando transcrição, histórico e análise técnica…</span>' +
      '</div>';
    }

    var historicoHtml = '';
    if(c.historico_metricas && c.historico_metricas.length > 0){
      var linhas = c.historico_metricas.map(function(h, idx){
        var prev = idx > 0 ? c.historico_metricas[idx - 1] : null;
        var dV = prev && h.views != null && prev.views != null ? h.views - prev.views : 0;
        var diffStr = dV > 0 ? '<span class="delta-pos">+' + esc(fmtK(dV)) + '</span>' : (idx === 0 ? '<span style="color:var(--faint)">Snapshot base</span>' : '—');
        return '<tr>' +
          '<td>' + esc(formatarData(h.data) || h.data) + '</td>' +
          '<td><b>' + (h.views != null ? esc(fmtK(h.views)) : '—') + '</b></td>' +
          '<td>' + (h.likes != null ? esc(fmtK(h.likes)) : '—') + '</td>' +
          '<td>' + (h.comentarios != null ? esc(fmtK(h.comentarios)) : '—') + '</td>' +
          '<td>' + diffStr + '</td>' +
        '</tr>';
      }).join('');
      historicoHtml = '<section class="bloco"><h2>Histórico de Métricas & Tração</h2>' +
        (c.crescimento && c.crescimento.delta_views > 0 ? '<div style="margin-bottom:8px;font-family:var(--mono);font-size:12px;color:var(--hot, #ff6b4a)">Tração recente: <b>' + esc(deltaViews(c.crescimento)) + ' views</b> (' + esc(c.crescimento.pct_views || 0) + '% de ganho)</div>' : '') +
        '<div style="overflow-x:auto"><table class="tabela-historico">' +
          '<thead><tr><th>Data / Hora</th><th>Views</th><th>Likes</th><th>Comentários</th><th>Ganho</th></tr></thead>' +
          '<tbody>' + linhas + '</tbody>' +
        '</table></div></section>';
    }

    var laudo = (c.analysis || []).map(function(a){
      var chaveGuia = chaveGuiaParaRotulo(a.label);
      var iconeGuia = chaveGuia ? '<button class="guia-icone" data-guia="' + chaveGuia + '" aria-label="Como analisar este campo" title="Como analisar este campo">?</button>' : '';
      return '<div class="item"><div class="rot-linha"><div class="rot">' + esc(a.label) + '</div>' + iconeGuia + '</div>' +
             '<div class="txt">' + esc(a.text) + '</div></div>';
    }).join('');

    var coms = (c.comentarios_amostra || []).map(function(x){
      return '<div class="coment"><span class="quem">@' + esc(x.autor) + '</span>' +
             '<span class="oque">' + esc(x.texto) + '</span></div>';
    }).join('');
    var en = (c.transcription_en || []).map(function(p){ return '<p>' + esc(p) + '</p>'; }).join('');
    var pt = (c.translation_pt || []).map(function(p){ return '<p>' + esc(p) + '</p>'; }).join('');
    var framesHtml = framesUi ? framesUi.renderSection(c.frames, esc) : '';

    html += historicoHtml;
    if(c.legenda){
      html += '<section class="bloco"><h2>Legenda / Copy Completa (Instagram)</h2>' +
        '<div class="legenda-caixa">' + esc(c.legenda) + '</div></section>';
    }
    if(c.transcricao_audio || c.traducao_audio){
      if(c.traducao_audio){
        html += '<section class="bloco"><h2>Transcrição e Tradução do Áudio</h2><div class="fala">' +
          '<div class="en"><h3>Original (' + esc(c.language || 'Áudio') + ')</h3><div class="legenda-caixa">' + esc(c.transcricao_audio || '') + '</div></div>' +
          '<div class="pt"><h3>Tradução (Português)</h3><div class="legenda-caixa">' + esc(c.traducao_audio || '') + '</div></div>' +
        '</div></section>';
      } else {
        html += '<section class="bloco"><h2>Transcrição do Áudio</h2>' +
          '<div class="legenda-caixa">' + esc(c.transcricao_audio) + '</div></section>';
      }
    }
    if(framesHtml) html += framesHtml;
    if(laudo) html += '<section class="bloco"><h2>Análise visual</h2>' + laudo + '</section>';
    if(en || pt){
      html += '<section class="bloco"><h2>Roteiro</h2><div class="fala">' +
        '<div class="en"><h3>Original</h3>' + en + '</div>' +
        '<div class="pt"><h3>Tradução</h3>' + pt + '</div></div></section>';
    }
    if(coms) html += '<section class="bloco"><h2>Comentários do público</h2>' + coms + '</section>';

    return html;
  }

  function abrir(i){
    if(i < 0 || i >= lista.length) return;
    // Acessibilidade: guarda de onde o foco veio (para devolver ao fechar) e,
    // na navegação ←/→, qual botão da ficha estava focado (o innerHTML o recria).
    if(!tela.classList.contains('aberta')) focoAntesFicha = document.activeElement;
    var focoNaFicha = document.activeElement && tela.contains(document.activeElement) ? document.activeElement.id : '';
    atual = i;
    var c = lista[i], pedido = ++pedidoFicha;
    fichaAberta = c;

    if(!c.metrics) c.metrics = metricasDe(c);
    if(!c.url && c.codigo) c.url = 'https://www.instagram.com/' + (c.tipo === 'post' ? 'p' : 'reel') + '/' + c.codigo + '/';
    if(!c.headline_metric_label) c.headline_metric_label = 'views';

    var aguardandoLote = !c._completo && !!c._lote;

    ficha.innerHTML =
      '<div class="ficha-topo">' +
        '<span class="cod">CV ' + c.number + '</span>' +
        '<span class="meta">' +
          (c.perfil ? '@' + esc(c.perfil) + ' · ' : '') +
          esc(c.language || 'Inglês') +
          (c.duration_s != null ? ' · ' + c.duration_s + 's' : '') +
          (c.codigo ? ' · ' + esc(c.codigo) : '') +
          (c.confidence != null ? ' · conf ' + c.confidence + '%' : '') + '</span>' +
        '<span class="gap"></span>' +
        '<button class="bt" id="favoritar" aria-pressed="' + favoritos.has(identidade(c)) + '">' + (favoritos.has(identidade(c)) ? 'Salvo no meu swipe' : 'Salvar no meu swipe') + '</button>' +
        (c.url ? '<a class="tag-ig" href="' + esc(c.url) + '" target="_blank" rel="noopener">Ver no Instagram ↗</a>' : '') +
        (c.codigo ? '<button class="bt bt-remover-link" onclick="window.marcarComoRemovido(\'' + esc(c.codigo) + '\')" title="Remover este post do catálogo se estiver quebrado ou apagado do Instagram">🗑️ Remover Link Defasado</button>' : '') +
        (c.video && c.status_download === 'BAIXADO' && MODO === 'local' ? '<a class="bt" href="' + esc(c.video) + '" download>Baixar Local ↓</a>' : '') +
        (c.url ? '<button class="bt" id="baixar-nuvem">Baixar Nuvem ↓</button>' : '') +
        (souAdmin && c.codigo ? '<a class="bt" href="/admin#criativo=' + encodeURIComponent(c.codigo) + '" target="_blank" rel="noopener">Editar (admin)</a>' : '') +
        '<button class="bt" id="ant"' + (i === 0 ? ' disabled' : '') + '>←</button>' +
        '<button class="bt" id="prox"' + (i === lista.length-1 ? ' disabled' : '') + '>→</button>' +
        '<button class="bt" id="fechar">Fechar</button>' +
      '</div>' +
      '<div class="ficha-corpo">' +
        '<div class="trilho">' +
          '<div class="player">' + player(c) + '</div>' +
          '<div class="trilho-metas">' + montarTrilhoMetasHtml(c) + '</div>' +
        '</div>' +
        '<div class="laudo">' +
          montarLaudoHtml(c, aguardandoLote) +
        '</div>' +
      '</div>';

    tela.classList.add('aberta');
    document.body.style.overflow = 'hidden';
    tela.scrollTop = 0;
    document.getElementById('fechar').onclick = fechar;
    document.getElementById('favoritar').onclick = function(){
      var chave = identidade(c), novos = new Set(favoritos);
      if(novos.has(chave)) novos.delete(chave); else novos.add(chave);
      try {localStorage.setItem('mesa-favoritos-v1', JSON.stringify(Array.from(novos)));}
      catch(e){alert('O navegador não permitiu salvar os favoritos.'); return;}
      favoritos = novos;
      this.textContent = favoritos.has(chave) ? 'Salvo no meu swipe' : 'Salvar no meu swipe';
      this.setAttribute('aria-pressed', String(favoritos.has(chave)));
    };
    document.getElementById('ant').onclick = function(){ abrir(atual - 1); };
    document.getElementById('prox').onclick = function(){ abrir(atual + 1); };
    var btNuvem = document.getElementById('baixar-nuvem');
    if(btNuvem) btNuvem.onclick = function(){ window.baixarOnDemand(c.url, btNuvem); };
    ligarPlayer(ficha.querySelector('.player'), c);

    if(aguardandoLote){
      carregarLote(c._lote).then(function(lote){
        if(pedido !== pedidoFicha || fichaAberta !== c) return;
        if(!Array.isArray(lote) || !lote[c._pos]) return;
        Object.assign(c, lote[c._pos]);
        c._completo = true;
        if(c._edicao) aplicarEdicao(c, c._edicao);

        var laudoEl = ficha.querySelector('.laudo');
        if(laudoEl){
          laudoEl.innerHTML = montarLaudoHtml(c, false);
        }
        var trilhoMetaEl = ficha.querySelector('.trilho-metas');
        if(trilhoMetaEl){
          trilhoMetaEl.innerHTML = montarTrilhoMetasHtml(c);
        }
        var playerEl = ficha.querySelector('.player');
        if(playerEl && playerEl.querySelector('.recado-aviso')){
          playerEl.innerHTML = player(c);
          ligarPlayer(playerEl, c);
        }
      }).catch(function(err){
        if(pedido !== pedidoFicha || fichaAberta !== c) return;
        var avisoEl = document.getElementById('status-carga-lote');
        if(avisoEl){
          avisoEl.innerHTML = '<span style="color:var(--dim)">Análise técnica indisponível no momento. O vídeo e dados do Instagram continuam normais.</span>';
        }
      });
    }

    var focar = focoNaFicha && document.getElementById(focoNaFicha);
    if(focar && !focar.disabled) focar.focus({preventScroll: true});
    else tela.focus({preventScroll: true});

    var fr = document.getElementById('quadro-video');
    if(fr){                                  // CSP pode barrar o iframe do Drive
      var caiu = setTimeout(function(){
        fr.outerHTML = '<div class="recado">' +
          '<span>A prévia do Drive não é permitida aqui.</span>' +
          '<a href="https://drive.google.com/file/d/' + esc(c.drive_id) +
          '/view" target="_blank" rel="noopener">Abrir no Drive ↗</a></div>';
      }, 2500);
      fr.addEventListener('load', function(){ clearTimeout(caiu); });
    }
  }

  function fechar(){
    pedidoFicha++;
    fecharFrame();
    tela.classList.remove('aberta');
    document.body.style.overflow = '';
    ficha.innerHTML = '';
    atual = -1;
    fichaAberta = null;
    var voltar = focoAntesFicha;
    focoAntesFicha = null;
    if(meuSwipe) filtrar();
    if(voltar && voltar.isConnected && voltar.focus) voltar.focus({preventScroll: true});
  }

  grade.addEventListener('click', function(e){
    var pillNicho = e.target.closest ? e.target.closest('.m-pill.m-nicho') : null;
    if(pillNicho){
      e.stopPropagation();
      e.preventDefault();
      var n = pillNicho.getAttribute('data-nicho') || pillNicho.textContent.trim();
      window.filtrarPorNicho(n, false);
      return;
    }
    var perfilCard = e.target.closest ? e.target.closest('.card-perfil') : null;
    if(perfilCard){ window.filtrarPorPerfil(perfilCard.getAttribute('data-filtrar-perfil')); return; }
    var b = e.target.closest ? e.target.closest('.cv') : null;
    if(!b) return;
    var n = parseInt(b.getAttribute('data-n'), 10);
    var perfil = b.getAttribute('data-perfil') || '';
    // `number` reinicia em 1 a cada perfil: sem casar o perfil, o swipe.html
    // global abria sempre o primeiro CV com aquele numero.
    abrir(lista.findIndex(function(c){
      return c.number === n && (c.perfil || '') === perfil;
    }));
  });
  ficha.addEventListener('click', function(e){
    var thumb = e.target.closest ? e.target.closest('.frame-thumb') : null;
    if(!thumb || !fichaAberta) return;
    abrirFrame(fichaAberta.frames, parseInt(thumb.getAttribute('data-frame-index'), 10));
  });
  frameViewer.querySelector('.frame-viewer-fechar').addEventListener('click', fecharFrame);
  frameViewer.querySelector('.frame-viewer-ant').addEventListener('click', function(){ moverFrame(-1); });
  frameViewer.querySelector('.frame-viewer-prox').addEventListener('click', function(){ moverFrame(1); });
  frameViewer.addEventListener('click', function(e){ if(e.target === frameViewer) fecharFrame(); });
  tela.addEventListener('click', function(e){ if(e.target === tela) fechar(); });
  // Capa/frame que não carregou (arquivo ausente ou link expirado): esconde o ícone
  // quebrado e o texto alternativo por cima dos selos; fica o fundo do quadro.
  document.addEventListener('error', function(e){
    var img = e.target;
    if(img && img.tagName === 'IMG' && img.closest && img.closest('.quadro, .player, .frame-thumb')) img.classList.add('img-falhou');
  }, true);
  // Mantém o Tab dentro do diálogo aberto (frame ampliado ou ficha).
  function prenderTab(e, caixa){
    var focaveis = Array.prototype.filter.call(
      caixa.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, video[controls], iframe, [tabindex]:not([tabindex="-1"])'),
      function(el){ return el.offsetParent !== null || el === document.activeElement; });
    if(!focaveis.length){ e.preventDefault(); caixa.focus(); return; }
    var primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    var dentro = caixa.contains(document.activeElement) && document.activeElement !== caixa;
    if(e.shiftKey && (!dentro || document.activeElement === primeiro)){ e.preventDefault(); ultimo.focus(); }
    else if(!e.shiftKey && (!dentro || document.activeElement === ultimo)){ e.preventDefault(); primeiro.focus(); }
  }

  document.addEventListener('keydown', function(e){
    if(atual < 0) return;
    if(e.key === 'Tab'){ prenderTab(e, frameViewer.hidden ? tela : frameViewer); return; }
    if(e.defaultPrevented) return;                        // Esc já usado para fechar o guia
    var seta = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    if(seta && (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) return;
    if(seta && e.target && /^(VIDEO|INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;   // setas do próprio controle
    if(!frameViewer.hidden){
      if(e.key === 'Escape') fecharFrame();
      else if(e.key === 'ArrowLeft') moverFrame(-1);
      else if(e.key === 'ArrowRight') moverFrame(1);
      else return;
      e.preventDefault();
      return;
    }
    if(e.key === 'Escape') fechar();
    else if(e.key === 'ArrowLeft') abrir(atual - 1);
    else if(e.key === 'ArrowRight') abrir(atual + 1);
  });
  q.placeholder = 'Buscar transcrição, legenda, perfil, gancho, hashtags…';
  q.title = 'Várias palavras = todas precisam aparecer. Use "aspas" para frase exata.';
  var esperaBusca;
  q.addEventListener('input', function(){
    if(q.value.trim() && selPerfil && !q.value.trim().startsWith('@')) selPerfil.value = '';
    clearTimeout(esperaBusca);
    esperaBusca = setTimeout(filtrar, 180);
  });
  ordem.addEventListener('change', filtrar);
  if(ordem2) ordem2.addEventListener('change', filtrar);
  if(selPeriodo) selPeriodo.addEventListener('change', filtrar);
  if(selViews) selViews.addEventListener('change', filtrar);
  function aoMudarNichoBiblioteca(){
    if(q) q.value = '';
    if(selPerfil) selPerfil.value = '';
    if(selNichoSwipers) selNichoSwipers.value = selNicho.value;
    atualizarOpcoesPerfis(selNicho.value);
    atualizarBotaoVerCriativos();
    filtrar();
  }
  if(selNicho){
    selNicho.addEventListener('change', aoMudarNichoBiblioteca);
    selNicho.onchange = aoMudarNichoBiblioteca;
  }

  function aoMudarNichoSwipers(){
    if(q) q.value = '';
    if(selPerfil) selPerfil.value = '';
    if(selNicho){
      selNicho.value = selNichoSwipers.value;
      atualizarOpcoesPerfis(selNichoSwipers.value);
    }
    atualizarBotaoVerCriativos();
    renderPerfis();
  }
  if(selNichoSwipers){
    selNichoSwipers.addEventListener('change', aoMudarNichoSwipers);
    selNichoSwipers.onchange = aoMudarNichoSwipers;
  }

  var btnVerCriativos = document.getElementById('btn-ver-criativos-nicho');
  if(btnVerCriativos){
    btnVerCriativos.addEventListener('click', function(){
      var n = selNichoSwipers ? selNichoSwipers.value : '';
      window.filtrarPorNicho(n, true);
    });
  }
  if(qSwipers){
    var esperaPerfis;
    qSwipers.addEventListener('input', function(){ clearTimeout(esperaPerfis); esperaPerfis = setTimeout(renderPerfis, 150); });
  }

  // Admin? O painel responde 200 só para os IDs de ADMIN_IDS; sem servidor (arquivo local) não aparece nada.
  var souAdmin = false;
  if(location.protocol !== 'file:' && window.fetch){
    fetch('/admin/api/eu', {credentials: 'same-origin', headers: {'Accept': 'application/json'}})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(eu){
        if(!eu || !eu.admin) return;
        souAdmin = true;
        var abas = document.querySelector('.abas');
        if(!abas || document.getElementById('aba-admin')) return;
        var a = document.createElement('a');
        a.className = 'aba'; a.id = 'aba-admin'; a.href = '/admin';
        a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>Admin';
        abas.appendChild(a);
      })
      .catch(function(){});
  }

  atualizarCabecalhoPagina('swipers');
  filtrar();
})();
