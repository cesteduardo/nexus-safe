window.Nexus.pronto(function () {
  'use strict';
  var N = window.Nexus;
  var raiz = document.querySelector('[data-ficha]');
  var d = N.carregar();
  var tk = new URLSearchParams(location.search).get('t');
  var c = d.candidatos.filter(function (x) { return x.token === tk; })[0];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }

  if (!c) {
    raiz.innerHTML = '<div class="ficha__corpo final"><h1>Link inválido</h1><p style="color:var(--apoio)">Este link de ficha não existe ou expirou. Peça um novo para a clínica.</p><a class="botao botao--claro" href="index.html">Ir para o modelo do CRM</a></div>';
    return;
  }

  if (window.NexusRegras.linkExpirado(c)) {
    raiz.innerHTML = '<div class="ficha__corpo final"><h1>Link expirado</h1><p style="color:var(--apoio)">Link expirado, peça outro à clínica. Ele vale por 7 dias.</p></div>';
    return;
  }

  var empresa = N.empresa(c.empresaId), funcao = N.funcao(c.funcaoId);
  var SELO = '<p class="selo-ns">Ficha protegida por <svg class="ns" viewBox="15 15 70 70" aria-hidden="true"><path class="ns__a" d="M22 64V34a12 12 0 0 1 12-12h30"/><path class="ns__b" d="M78 36v30a12 12 0 0 1-12 12H36"/><rect class="ns__c" x="42" y="42" width="16" height="16" rx="4"/></svg><b>Nexus Safe</b></p>';
  var primeiro = N.primeiroNome(c.nome);

  if (c.ficha) { telaFinal(true); return; }

  var st = (c.rascunho && c.rascunho.ficha) ? c.rascunho.ficha : {
    pessoais: { nome_social: '', nascimento: '', sexo: '', estado_civil: '', escolaridade: '', endereco: '', emergencia_nome: '', emergencia_parentesco: '', emergencia_tel: '', pcd: null },
    primeiroEmprego: false,
    trabalhos: [{ empresa: '', funcao: '', tempo: '', exposicoes: [], epi: '' }],
    acidentes: {}, saude: {}, cirurgias: '', remedios: '', alergias: '', oculos: '',
    habitos: { fuma: '', fuma_detalhe: '', alcool: '', atividade: '' }, familia: [], especificas: {}
  };

  var temEspecificas = funcao.riscos.some(function (r) { return (N.ESPECIFICAS[r] || []).length; });
  var PASSOS = ['inicio', 'dados', 'trabalho', 'saude', 'habitos'].concat(temEspecificas ? ['funcao'] : []).concat(['fim']);
  var passo = (c.rascunho && c.rascunho.ficha) ? Math.min(c.rascunho.passo || 0, PASSOS.length - 1) : 0;
  var assinou = false;

  /* ---------- peças ---------- */
  function sn(nome, rotulo, obj, ph) {
    var v = obj && obj.sim === true ? 'sim' : obj && obj.sim === false ? 'nao' : '';
    return '<fieldset class="sn" data-sn="' + nome + '"><legend>' + esc(rotulo) + '</legend><div class="sn__ops">' +
      '<label><input type="radio" name="' + nome + '" value="nao"' + (v === 'nao' ? ' checked' : '') + '>Não</label>' +
      '<label><input type="radio" name="' + nome + '" value="sim"' + (v === 'sim' ? ' checked' : '') + '>Sim</label></div>' +
      '<input class="entrada" name="' + nome + '__det" placeholder="' + esc(ph || 'Conte um pouco (quando, qual)') + '" value="' + esc(obj && obj.detalhe || '') + '"' + (v === 'sim' ? '' : ' hidden') + '></fieldset>';
  }
  function lerSn(f, nome) {
    var r = f.querySelector('input[name="' + nome + '"]:checked');
    if (!r) return null;
    var det = f.querySelector('[name="' + nome + '__det"]');
    return { sim: r.value === 'sim', detalhe: r.value === 'sim' && det ? det.value.trim() : '' };
  }
  function radios(nome, opcoes, valor) {
    return '<div class="opcoes" data-radio="' + nome + '">' + opcoes.map(function (o) { return '<label><input type="radio" name="' + nome + '" value="' + esc(o[0]) + '"' + (valor === o[0] ? ' checked' : '') + '>' + esc(o[1]) + '</label>'; }).join('') + '</div>';
  }
  function select(nome, opcoes, valor) {
    return '<select class="entrada" name="' + nome + '"><option value="">Escolha</option>' + opcoes.map(function (o) { return '<option' + (valor === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
  }
  function val(f, nome) { var e = f.querySelector('[name="' + nome + '"]'); return e ? e.value.trim() : ''; }
  function radioVal(f, nome) { var r = f.querySelector('input[name="' + nome + '"]:checked'); return r ? r.value : ''; }

  /* ---------- telas ---------- */
  var TELAS = {
    inicio: function () {
      return '<h1>Olá, ' + esc(primeiro) + '!</h1>' +
        '<p>Esta é a ficha do seu exame ' + esc(N.nomeTipo(c.tipoExame).toLowerCase()) + ' para <b>' + esc(funcao.nome) + '</b> na <b>' + esc(empresa.nome.replace(/ \(fict[íi]ci[ao]\)/, '')) + '</b>. Leva uns 10 minutos.</p>' +
        '<div class="info"><b>Suas respostas de saúde ficam só com a equipe médica</b> da ' + esc(d.clinica) + '. A empresa recebe apenas o resultado do exame (apto ou inapto).</div>' +
        '<div class="caixa"><h3>Tenha à mão</h3><p style="font-size:15px;color:var(--apoio)">Seus documentos, o nome das últimas empresas em que trabalhou e o nome dos remédios que usa.</p></div>' +
        '<p style="font-size:14px">Se precisar parar, suas respostas ficam salvas neste celular. É só abrir o mesmo link depois.</p>' + SELO;
    },
    dados: function () {
      var p = st.pessoais;
      return '<h1>Seus dados</h1>' +
        '<div class="grupo">' +
        '<label class="campo">Nome completo<input class="entrada" value="' + esc(c.nome) + '" readonly></label>' +
        '<label class="campo">Nome social <small>(opcional)</small><input class="entrada" name="nome_social" value="' + esc(p.nome_social) + '" data-campo="nome" data-opcional autocomplete="off"></label>' +
        '<div class="duas"><label class="campo">CPF<input class="entrada" value="' + esc(c.cpf) + '" readonly></label>' +
        '<label class="campo">Nascimento<input class="entrada" type="date" name="nascimento" value="' + esc(p.nascimento) + '" required data-nascimento></label></div>' +
        '<div class="duas"><label class="campo">Sexo' + select('sexo', ['Feminino', 'Masculino'], p.sexo) + '</label>' +
        '<label class="campo">Estado civil' + select('estado_civil', ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'], p.estado_civil) + '</label></div>' +
        '<label class="campo">Escolaridade' + select('escolaridade', ['Fundamental incompleto', 'Fundamental completo', 'Ensino médio incompleto', 'Ensino médio completo', 'Superior incompleto', 'Superior completo'], p.escolaridade) + '</label>' +
        '<label class="campo">Endereço<input class="entrada" name="endereco" value="' + esc(p.endereco) + '" autocomplete="street-address" placeholder="Rua, número, bairro"></label>' +
        '<div class="caixa"><h3>Contato de emergência</h3><div class="duas"><label class="campo">Nome<input class="entrada" name="emergencia_nome" value="' + esc(p.emergencia_nome) + '" placeholder="Ex.: Maria Souza" data-campo="nome" autocomplete="off"></label>' +
        '<label class="campo">Parentesco' + select('emergencia_parentesco', ['Mãe', 'Pai', 'Cônjuge', 'Filho(a)', 'Irmão(ã)', 'Outro'], p.emergencia_parentesco) + '</label></div>' +
        '<label class="campo">Telefone<input class="entrada" name="emergencia_tel" inputmode="tel" placeholder="(17) 99999-9999" value="' + esc(p.emergencia_tel) + '" data-campo="tel"></label></div>' +
        sn('pcd', 'Você é pessoa com deficiência (PcD)?', p.pcd, 'Qual?') +
        '</div>';
    },
    trabalho: function () {
      var h = '<h1>Trabalhos anteriores</h1><p>Comece pelo mais recente. Até três já está ótimo.</p>' +
        '<label class="check"><input type="checkbox" name="primeiro"' + (st.primeiroEmprego ? ' checked' : '') + '>Este é o meu primeiro emprego</label>';
      h += '<div class="grupo" data-trabalhos' + (st.primeiroEmprego ? ' hidden' : '') + '>';
      st.trabalhos.forEach(function (t, i) {
        h += '<div class="caixa"><h3>Emprego ' + (i + 1) + '</h3>' +
          '<label class="campo">Empresa<input class="entrada" name="t' + i + '_empresa" value="' + esc(t.empresa) + '"></label>' +
          '<div class="duas"><label class="campo">Função<input class="entrada" name="t' + i + '_funcao" value="' + esc(t.funcao) + '"></label>' +
          '<label class="campo">Quanto tempo<input class="entrada" name="t' + i + '_tempo" value="' + esc(t.tempo) + '" placeholder="Ex.: 2 anos"></label></div>' +
          '<div class="campo">Ficava exposto(a) a<div class="opcoes">' + N.EXPOSICOES.map(function (x) { return '<label><input type="checkbox" name="t' + i + '_exp" value="' + esc(x) + '"' + (t.exposicoes.indexOf(x) >= 0 ? ' checked' : '') + '>' + esc(x) + '</label>'; }).join('') + '</div></div>' +
          '<div class="campo">Usava EPI (protetor, luva, máscara)?' + radios('t' + i + '_epi', [['sim', 'Sim'], ['as_vezes', 'Às vezes'], ['nao', 'Não']], t.epi) + '</div>' +
          (i > 0 ? '<button type="button" class="link-texto" data-remover="' + i + '">Remover este emprego</button>' : '') + '</div>';
      });
      if (st.trabalhos.length < 3) h += '<button type="button" class="botao botao--claro" data-adicionar>+ Adicionar outro emprego</button>';
      h += '</div>';
      var a = st.acidentes;
      h += '<div class="grupo">' + sn('acidente', 'Já sofreu acidente de trabalho?', a.acidente, 'O que aconteceu e quando') +
        sn('inss', 'Já ficou afastado(a) pelo INSS?', a.inss, 'Por quê e por quanto tempo') +
        sn('ocupacional', 'Já teve alguma doença causada pelo trabalho?', a.ocupacional, 'Qual') + '</div>';
      return h;
    },
    saude: function () {
      var h = '<h1>Sua saúde</h1><p>Você tem ou já teve algum destes problemas?</p>' +
        '<button type="button" class="botao botao--claro" data-nenhum>Não tenho nenhum destes</button><div>';
      N.SAUDE.forEach(function (s) { h += sn('s_' + s[0], s[1], st.saude[s[0]]); });
      h += '</div><div class="grupo">' +
        '<label class="campo">Já fez alguma cirurgia ou ficou internado(a)? <small>Deixe em branco se não</small><textarea class="entrada" name="cirurgias" placeholder="Qual e quando">' + esc(st.cirurgias === 'Nenhuma' ? '' : st.cirurgias) + '</textarea></label>' +
        '<label class="campo">Remédios que usa todo dia <small>Deixe em branco se não usa</small><input class="entrada" name="remedios" value="' + esc(st.remedios === 'Nenhum' ? '' : st.remedios) + '"></label>' +
        '<label class="campo">Alergias <small>Remédio, alimento, produto</small><input class="entrada" name="alergias" value="' + esc(st.alergias === 'Nenhuma' ? '' : st.alergias) + '"></label>' +
        '<div class="campo">Usa óculos ou lente de contato?' + radios('oculos', [['nao', 'Não'], ['sim', 'Sim']], st.oculos) + '</div></div>';
      return h;
    },
    habitos: function () {
      var hb = st.habitos;
      return '<h1>Hábitos e família</h1><div class="grupo">' +
        '<div class="campo">Você fuma?' + radios('fuma', [['nao', 'Não'], ['sim', 'Sim'], ['parou', 'Parei']], hb.fuma) + '</div>' +
        '<input class="entrada" name="fuma_detalhe" placeholder="Quantos por dia e há quanto tempo" value="' + esc(hb.fuma_detalhe) + '"' + (hb.fuma === 'sim' ? '' : ' hidden') + '>' +
        '<div class="campo">Bebida alcoólica' + radios('alcool', [['não bebe', 'Não bebo'], ['socialmente', 'Socialmente'], ['toda semana', 'Toda semana'], ['todo dia', 'Todo dia']], hb.alcool) + '</div>' +
        '<div class="campo">Faz atividade física?' + radios('atividade', [['sim', 'Sim'], ['nao', 'Não']], hb.atividade) + '</div>' +
        '<div class="campo">Alguém da família (pais ou irmãos) tem<div class="opcoes">' + N.FAMILIA.map(function (x) { return '<label><input type="checkbox" name="familia" value="' + esc(x) + '"' + (st.familia.indexOf(x) >= 0 ? ' checked' : '') + '>' + esc(x) + '</label>'; }).join('') + '</div><small>Se ninguém tem, deixe sem marcar.</small></div>' +
        '</div>';
    },
    funcao: function () {
      var nomes = funcao.riscos.filter(function (r) { return (N.ESPECIFICAS[r] || []).length; }).map(function (r) { return N.RISCOS[r].toLowerCase(); });
      var h = '<h1>Sobre a função</h1><p>Estas perguntas aparecem porque a função de ' + esc(funcao.nome) + ' envolve ' + esc(nomes.join(', ').replace(/, ([^,]*)$/, ' e $1')) + '.</p><div>';
      var vistos = [];
      funcao.riscos.forEach(function (r) {
        (N.ESPECIFICAS[r] || []).forEach(function (q) { if (vistos.indexOf(q[0]) >= 0) return; vistos.push(q[0]); h += sn('e_' + q[0], q[1], st.especificas[q[0]]); });
      });
      h += '</div>';
      var prep = N.preparos(funcao);
      if (prep.length) h += '<div class="info"><b>Para o dia do exame:</b> ' + prep.map(esc).join('; ') + '.</div>';
      return h;
    },
    fim: function () {
      return '<h1>Quase pronto</h1><p>Confira e assine para enviar.</p>' +
        '<label class="check"><input type="checkbox" name="declaro" required>Declaro que as informações desta ficha são verdadeiras.</label>' +
        '<label class="check"><input type="checkbox" name="lgpd" required>Autorizo a ' + esc(d.clinica) + ' a usar estas informações de saúde só para o meu exame ocupacional, com acesso restrito à equipe médica (LGPD).</label>' +
        '<details class="termo"><summary>Ler termo completo</summary><div class="termo__texto">' +
          '<p><b>Finalidade.</b> As informações de saúde desta ficha servem só para a avaliação do seu exame ocupacional (admissional, periódico, retorno, mudança de riscos ou demissional) e para a emissão do ASO.</p>' +
          '<p><b>Quem acessa.</b> Somente a equipe médica da ' + esc(d.clinica) + '. A empresa que contratou o exame recebe apenas o resultado do ASO (apto ou inapto), nunca as suas respostas.</p>' +
          '<p><b>Por quanto tempo.</b> A ficha fica guardada pelo prazo que a norma de saúde ocupacional exige para o prontuário.</p>' +
          '<p><b>Seus direitos.</b> Você pode pedir à clínica uma cópia, a correção ou a explicação sobre o uso dos seus dados, e retirar esta autorização quando quiser, nos termos da LGPD (Lei 13.709/2018).</p>' +
          '</div></details>' +
        '<div class="campo">Sua assinatura<div class="tela"><canvas data-assinatura aria-label="Assine com o dedo"></canvas><span></span><small>Assine com o dedo</small></div><button type="button" class="link-texto" data-limpar>Limpar assinatura</button></div>';
    }
  };

  /* ---------- coleta e validação ---------- */
  var COLETA = {
    inicio: function () { return []; },
    dados: function (f) {
      var p = st.pessoais, faltam = [];
      ['nome_social', 'nascimento', 'sexo', 'estado_civil', 'escolaridade', 'endereco', 'emergencia_nome', 'emergencia_parentesco', 'emergencia_tel'].forEach(function (k) { p[k] = val(f, k); });
      ['nascimento', 'sexo', 'estado_civil', 'escolaridade', 'endereco', 'emergencia_nome', 'emergencia_parentesco', 'emergencia_tel'].forEach(function (k) { if (!p[k]) faltam.push(f.querySelector('[name="' + k + '"]').closest('.campo')); });
      p.pcd = lerSn(f, 'pcd'); if (!p.pcd) faltam.push(f.querySelector('[data-sn="pcd"]'));
      return faltam;
    },
    trabalho: function (f, soGuardar) {
      var faltam = [];
      st.primeiroEmprego = f.querySelector('[name="primeiro"]').checked;
      st.trabalhos = st.trabalhos.map(function (t, i) {
        return { empresa: val(f, 't' + i + '_empresa'), funcao: val(f, 't' + i + '_funcao'), tempo: val(f, 't' + i + '_tempo'),
          exposicoes: Array.prototype.map.call(f.querySelectorAll('[name="t' + i + '_exp"]:checked'), function (x) { return x.value; }), epi: radioVal(f, 't' + i + '_epi') };
      });
      if (!soGuardar && !st.primeiroEmprego) st.trabalhos.forEach(function (t, i) { if (!t.empresa || !t.funcao) faltam.push(f.querySelector('[name="t' + i + '_empresa"]').closest('.caixa')); });
      ['acidente', 'inss', 'ocupacional'].forEach(function (k) { st.acidentes[k] = lerSn(f, k); if (!st.acidentes[k]) faltam.push(f.querySelector('[data-sn="' + k + '"]')); });
      return faltam;
    },
    saude: function (f) {
      var faltam = [];
      N.SAUDE.forEach(function (s) { st.saude[s[0]] = lerSn(f, 's_' + s[0]); if (!st.saude[s[0]]) faltam.push(f.querySelector('[data-sn="s_' + s[0] + '"]')); });
      st.cirurgias = val(f, 'cirurgias') || 'Nenhuma'; st.remedios = val(f, 'remedios') || 'Nenhum'; st.alergias = val(f, 'alergias') || 'Nenhuma';
      st.oculos = radioVal(f, 'oculos'); if (!st.oculos) faltam.push(f.querySelector('[data-radio="oculos"]').closest('.campo'));
      return faltam;
    },
    habitos: function (f) {
      var hb = st.habitos, faltam = [];
      hb.fuma = radioVal(f, 'fuma'); hb.fuma_detalhe = hb.fuma === 'sim' ? val(f, 'fuma_detalhe') : '';
      hb.alcool = radioVal(f, 'alcool'); hb.atividade = radioVal(f, 'atividade');
      ['fuma', 'alcool', 'atividade'].forEach(function (k) { if (!hb[k]) faltam.push(f.querySelector('[data-radio="' + k + '"]').closest('.campo')); });
      st.familia = Array.prototype.map.call(f.querySelectorAll('[name="familia"]:checked'), function (x) { return x.value; });
      return faltam;
    },
    funcao: function (f) {
      var faltam = [];
      f.querySelectorAll('[data-sn^="e_"]').forEach(function (fs) { var k = fs.dataset.sn.slice(2); st.especificas[k] = lerSn(f, 'e_' + k); if (!st.especificas[k]) faltam.push(fs); });
      return faltam;
    },
    fim: function (f) {
      var faltam = [];
      if (!f.querySelector('[name="declaro"]').checked) faltam.push(f.querySelector('[name="declaro"]').closest('.check'));
      if (!f.querySelector('[name="lgpd"]').checked) faltam.push(f.querySelector('[name="lgpd"]').closest('.check'));
      if (!assinou) faltam.push(f.querySelector('.tela').closest('.campo'));
      return faltam;
    }
  };

  function guardarRascunho() {
    if (c.etapa === 'enviado') { c.etapa = 'preenchendo'; c.historico.push({ em: new Date().toISOString(), txt: 'Abriu a ficha e começou a preencher.' }); }
    c.rascunho = { passo: passo, ficha: st };
    N.salvar();
  }

  /* ---------- render ---------- */
  function render() {
    var nome = PASSOS[passo];
    var total = PASSOS.length - 1;
    var ultimo = nome === 'fim';
    raiz.innerHTML =
      '<div class="ficha__topo"><div class="ficha__topo-linha"><span class="ficha__clinica">' + esc(d.clinica) + '</span><span>' + (passo === 0 ? 'Leva uns 10 minutos' : 'Passo ' + passo + ' de ' + total) + '</span></div>' +
      '<div class="barra" aria-hidden="true"><span style="width:' + Math.round((passo / total) * 100) + '%"></span></div></div>' +
      '<form class="ficha__form" novalidate style="display:flex;flex-direction:column;flex:1"><div class="ficha__corpo"><p class="erro" data-erro role="alert" hidden></p>' + TELAS[nome]() + '</div>' +
      '<div class="ficha__pe">' + (passo > 0 ? '<button type="button" class="botao botao--claro" data-voltar>Voltar</button>' : '') +
      '<button class="botao" type="submit">' + (passo === 0 ? 'Começar' : ultimo ? 'Enviar ficha' : 'Continuar') + '</button></div></form>';
    if (ultimo) prepararAssinatura();
    window.scrollTo(0, 0);
  }

  function telaFinal(jaEnviada) {
    raiz.innerHTML = '<div class="ficha__corpo final"><div class="final__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></div>' +
      '<h1>' + (jaEnviada ? 'Ficha já enviada' : 'Ficha enviada!') + '</h1>' +
      '<p style="color:var(--apoio);max-width:24em">Obrigado, ' + esc(primeiro) + '. A ' + esc(d.clinica) + ' vai chamar você pelo WhatsApp para marcar o exame.</p>' +
      '<div class="info" style="text-align:left;margin-top:12px"><b>Demonstração:</b> volte ao CRM para ver a ficha chegando na coluna "Ficha recebida", com os pontos de atenção para o médico.</div>' +
      '<a class="botao" href="index.html#/c/' + c.id + '">Ver no CRM</a>' + SELO + '</div>';
  }

  /* ---------- assinatura ---------- */
  function prepararAssinatura() {
    var cv = raiz.querySelector('[data-assinatura]');
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0F1F1B';
    var desenhando = false, ult = null;
    function pos(e) { var b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
    cv.addEventListener('pointerdown', function (e) { desenhando = true; ult = pos(e); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) { if (!desenhando) return; var p = pos(e); ctx.beginPath(); ctx.moveTo(ult.x, ult.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ult = p; assinou = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { cv.addEventListener(n, function () { desenhando = false; }); });
    raiz.querySelector('[data-limpar]').addEventListener('click', function () { ctx.clearRect(0, 0, cv.width, cv.height); assinou = false; });
  }

  /* ---------- eventos ---------- */
  raiz.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target, nome = PASSOS[passo];
    f.querySelectorAll('.faltando').forEach(function (x) { x.classList.remove('faltando'); });
    var faltam = COLETA[nome](f).filter(Boolean);
    window.Campos.validar(f).forEach(function (el) { var cx = el.closest('.campo') || el; if (faltam.indexOf(cx) < 0) faltam.push(cx); });
    var erro = f.querySelector('[data-erro]');
    if (faltam.length) {
      faltam.forEach(function (x) { x.classList.add('faltando'); });
      erro.textContent = faltam.length === 1 ? 'Falta responder 1 item, marcado em vermelho.' : 'Faltam ' + faltam.length + ' itens, marcados em vermelho.';
      erro.hidden = false;
      faltam[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (nome !== 'inicio') guardarRascunho();
      return;
    }
    if (nome === 'fim') {
      st.aceite = true; st.assinatura = raiz.querySelector('[data-assinatura]').toDataURL('image/png'); st.enviadoEm = new Date().toISOString();
      c.ficha = st; c.rascunho = null; c.etapa = 'recebida';
      c.historico.push({ em: st.enviadoEm, txt: 'Ficha enviada pelo candidato.' });
      var botao = f.querySelector('button[type=submit]'); if (botao) { botao.disabled = true; botao.textContent = 'Enviando...'; }
      N.enviarFicha(c).then(function () { telaFinal(false); window.scrollTo(0, 0); }, function (e) {
        c.ficha = null; c.etapa = 'preenchendo';
        if (botao) { botao.disabled = false; botao.textContent = 'Enviar ficha'; }
        erro.textContent = 'Não foi possível enviar agora (' + (e && e.message ? e.message : 'sem conexão') + '). Suas respostas continuam salvas; tente de novo.'; erro.hidden = false;
      });
      return;
    }
    passo++; guardarRascunho(); render();
  });

  raiz.addEventListener('click', function (ev) {
    var t = ev.target.closest('button'); if (!t) return;
    var f = raiz.querySelector('form');
    if (t.matches('[data-voltar]')) { COLETA[PASSOS[passo]](f, true); passo--; guardarRascunho(); render(); }
    else if (t.matches('[data-adicionar]')) { COLETA.trabalho(f, true); st.trabalhos.push({ empresa: '', funcao: '', tempo: '', exposicoes: [], epi: '' }); render(); }
    else if (t.matches('[data-remover]')) { COLETA.trabalho(f, true); st.trabalhos.splice(Number(t.dataset.remover), 1); render(); }
    else if (t.matches('[data-nenhum]')) {
      f.querySelectorAll('[data-sn^="s_"] input[value="nao"]').forEach(function (r) { var marcado = f.querySelector('input[name="' + r.name + '"]:checked'); if (!marcado) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } });
    }
  });

  raiz.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.type === 'radio' && t.closest('.sn')) {
      var det = t.closest('.sn').querySelector('[name="' + t.name + '__det"]');
      if (det) { det.hidden = t.value !== 'sim'; if (t.value === 'sim') det.focus(); }
      t.closest('.sn').classList.remove('faltando');
    }
    if (t.name === 'fuma') { var fd = raiz.querySelector('[name="fuma_detalhe"]'); fd.hidden = t.value !== 'sim'; }
    if (t.name === 'primeiro') raiz.querySelector('[data-trabalhos]').hidden = t.checked;
    var cx = t.closest('.faltando'); if (cx) cx.classList.remove('faltando');
  });

  /* rascunho a cada campo alterado, para não perder nada se o navegador fechar */
  function guardarCampo(ev) {
    var f = raiz.querySelector('form'), nome = PASSOS[passo];
    if (!f || nome === 'inicio' || nome === 'fim' || !f.contains(ev.target)) return;
    try { COLETA[nome](f, true); guardarRascunho(); } catch (e) { /* segue sem salvar */ }
  }
  raiz.addEventListener('input', guardarCampo);
  raiz.addEventListener('change', guardarCampo);

  render();
});
