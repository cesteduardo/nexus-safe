/* Nexus Safe · campos de formulário (padrão GR Brands 2)
   Nome: só letras, acentos, espaço, apóstrofo e hífen.
   Telefone: DDD + número, sem +55, máscara (17) 99999-9999.
   CPF: só dígitos, máscara 000.000.000-00, dígitos verificadores.
   A limpeza acontece ao digitar e ao colar; o caractere inválido nem aparece. */
(function () {
  'use strict';

  var NAO_NOME = /[^\p{L}\p{M}' ’\-]/gu;
  function limparNome(v) { return v.replace(NAO_NOME, '').replace(/’/g, "'").replace(/ {2,}/g, ' ').replace(/^[ '\-]+/, ''); }
  function nomeValido(v) { v = v.trim(); return v.length >= 2 && /\p{L}/u.test(v) && !/[^\p{L}\p{M}' \-]/u.test(v); }

  function digitos(v) { return String(v || '').replace(/\D/g, ''); }

  /* Tira o 55 só quando é código de país: veio com "+" ou sobram DDD + número depois dele.
     Um 55 que é o próprio DDD (Rio Grande do Sul) fica. */
  function semPais(bruto) {
    var d = digitos(bruto);
    if (/^\s*\+\s*55/.test(bruto) || /^\s*0055/.test(bruto)) d = d.replace(/^0{0,2}55/, '');
    else if (/^55/.test(d) && d.length >= 12) d = d.slice(2);
    if (/^0\d{10,11}$/.test(d)) d = d.slice(1); /* 0 + DDD de discagem a distância */
    return d.slice(0, 11);
  }
  function mascaraTel(d) {
    d = digitos(d).slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return '(' + d;
    var resto = d.slice(2), corte = d.length === 11 ? 5 : 4;
    if (resto.length <= corte) return '(' + d.slice(0, 2) + ') ' + resto;
    return '(' + d.slice(0, 2) + ') ' + resto.slice(0, corte) + '-' + resto.slice(corte);
  }
  function telValido(v) {
    var d = digitos(v);
    if (!/^[1-9][1-9]/.test(d)) return false;
    if (d.length === 11) return d[2] === '9';
    return d.length === 10 && /[2-5]/.test(d[2]);
  }

  function mascaraCpf(v) { v = digitos(v).slice(0, 11); return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
  function cpfValido(v) {
    var d = digitos(v);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
  }

  /* Reaplica a limpeza mantendo o cursor no lugar certo. */
  function reaplicar(el, formatar, conta) {
    var antes = el.value, pos = el.selectionStart == null ? antes.length : el.selectionStart;
    var n = 0; for (var i = 0; i < pos; i++) if (conta(antes[i])) n++;
    var depois = formatar(antes);
    if (depois === antes) return;
    el.value = depois;
    var p = 0, k = 0; while (p < depois.length && k < n) { if (conta(depois[p])) k++; p++; }
    try { el.setSelectionRange(p, p); } catch (e) { /* campo sem cursor */ }
  }
  var ehDigito = function (ch) { return /\d/.test(ch); };
  var ehLetra = function (ch) { return /[\p{L}\p{M}' \-]/u.test(ch); };

  var REGRAS = {
    nome: { formatar: limparNome, conta: ehLetra, colar: limparNome },
    tel: { formatar: function (v) { return mascaraTel(semPais(v)); }, conta: ehDigito, colar: semPais },
    cpf: { formatar: mascaraCpf, conta: ehDigito, colar: digitos }
  };

  function tipo(el) { return el && el.dataset ? el.dataset.campo : null; }

  document.addEventListener('input', function (ev) {
    var r = REGRAS[tipo(ev.target)]; if (!r) return;
    reaplicar(ev.target, r.formatar, r.conta);
    ev.target.closest('.campo') && ev.target.closest('.campo').classList.remove('faltando');
    var msg = ev.target.parentNode.querySelector('.campo__erro'); if (msg) msg.remove();
  }, true);

  /* Colar: limpa o que veio da área de transferência antes de entrar no campo. */
  document.addEventListener('paste', function (ev) {
    var el = ev.target, r = REGRAS[tipo(el)]; if (!r) return;
    var txt = (ev.clipboardData || window.clipboardData).getData('text') || '';
    ev.preventDefault();
    var ini = el.selectionStart, fim = el.selectionEnd, v = el.value;
    var limpo = r.colar(txt);
    var tudo = (ini === 0 && fim === v.length) ? limpo : v.slice(0, ini) + limpo + v.slice(fim);
    el.value = r.formatar(tipo(el) === 'tel' ? (ini === 0 && fim === v.length ? limpo : digitos(tudo)) : tudo);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);

  /* Validação completa no envio. Devolve a lista de campos com erro, já marcados. */
  function validar(form) {
    var erros = [];
    form.querySelectorAll('.campo__erro').forEach(function (x) { x.remove(); });
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.disabled || el.readOnly || el.type === 'hidden' || el.closest('[hidden]')) return;
      var v = el.value.trim(), t = tipo(el), msg = '';
      var opcional = el.hasAttribute('data-opcional');
      if (!v) { if (!opcional && (el.required || t)) msg = 'Preencha este campo.'; }
      else if (t === 'nome' && !nomeValido(v)) msg = 'Use só letras.';
      else if (t === 'tel' && !telValido(v)) msg = 'Telefone com DDD, como (17) 99999-9999.';
      else if (t === 'cpf' && !cpfValido(v)) msg = 'CPF inválido. Confira os números.';
      else if (el.dataset.nascimento != null) msg = erroNascimento(v);
      else if (el.dataset.futuro != null) { var hj = new Date(); hj.setHours(0, 0, 0, 0); if (new Date(v + 'T12:00:00') < hj) msg = 'A data não pode ser no passado.'; }
      if (msg) {
        var m = document.createElement('span'); m.className = 'campo__erro'; m.textContent = msg;
        el.insertAdjacentElement('afterend', m);
        var c = el.closest('.campo'); if (c) c.classList.add('faltando');
        erros.push(el);
      }
    });
    if (erros.length) erros[0].focus();
    return erros;
  }

  function erroNascimento(v) {
    var d = new Date(v + 'T12:00:00'); if (isNaN(d)) return 'Data inválida.';
    var hoje = new Date(); if (d > hoje) return 'A data não pode ser no futuro.';
    var idade = hoje.getFullYear() - d.getFullYear() - ((hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) ? 1 : 0);
    if (idade < 14) return 'A idade mínima para trabalhar é 14 anos.';
    if (idade > 100) return 'Confira o ano de nascimento.';
    return '';
  }

  window.Campos = { limparNome: limparNome, nomeValido: nomeValido, semPais: semPais, mascaraTel: mascaraTel, telValido: telValido, mascaraCpf: mascaraCpf, cpfValido: cpfValido, validar: validar, erroNascimento: erroNascimento, digitos: digitos };
})();
