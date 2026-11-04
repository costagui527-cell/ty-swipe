(function(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.MesaPerfisLogica = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  function perfisConhecidos(dados, perfisMeta){
    var nomes = [], vistos = {};
    function incluir(nome){
      nome = String(nome || '').replace(/^@/, '').trim();
      var chave = nome.toLowerCase();
      if(!nome || vistos[chave]) return;
      vistos[chave] = true;
      nomes.push(nome);
    }
    (dados || []).forEach(function(item){ incluir(item && item.perfil); });
    Object.keys(perfisMeta || {}).forEach(incluir);
    return nomes;
  }

  return {perfisConhecidos: perfisConhecidos};
});
