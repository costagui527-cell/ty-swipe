(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.MesaFrames = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  function normalizarFrames(valor){
    if(!Array.isArray(valor)) return [];
    return valor.filter(function(src){
      return typeof src === 'string' && src.trim() !== '';
    });
  }

  function renderSection(valor, escapeHtml){
    var frames = normalizarFrames(valor);
    if(!frames.length) return '';
    var esc = typeof escapeHtml === 'function' ? escapeHtml : String;
    var total = frames.length;
    var itens = frames.map(function(src, indice){
      var posicao = indice + 1;
      return '<button class="frame-thumb" type="button" role="listitem" data-frame-index="' + indice + '"' +
        ' aria-label="Ampliar frame ' + posicao + ' de ' + total + '">' +
          '<img src="' + esc(src) + '" loading="lazy" decoding="async"' +
            ' alt="Frame ' + posicao + ' de ' + total + '">' +
          '<span>' + String(posicao).padStart(2, '0') + '</span>' +
        '</button>';
    }).join('');
    return '<section class="bloco frames-bloco">' +
      '<h2>Frames do criativo <span>· ' + total + '</span></h2>' +
      '<div class="frames-grade" role="list">' + itens + '</div>' +
    '</section>';
  }

  function moveIndex(indice, total, delta){
    if(total <= 0) return -1;
    return Math.max(0, Math.min(total - 1, indice + delta));
  }

  return {
    normalizarFrames: normalizarFrames,
    renderSection: renderSection,
    moveIndex: moveIndex
  };
});
