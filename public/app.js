'use strict';

// ---------------------------------------------------------------------------
// Estado e metadados
// ---------------------------------------------------------------------------
const CAMPOS = [
  { key: 'fabricante', label: 'Fabricante' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'rotacaoRPM', label: 'Rotação (RPM)' },
  { key: 'potenciaCV', label: 'Potência (CV)' },
  { key: 'potenciaKW', label: 'Potência (kW)' },
  { key: 'rendimento', label: 'Rendimento (%)' },
  { key: 'numeroSerie', label: 'Número de série' },
  { key: 'anoFabricacao', label: 'Ano de fabricação' },
  { key: 'tensao', label: 'Tensão (V)' },
  { key: 'corrente', label: 'Corrente (A)' },
  { key: 'frequencia', label: 'Frequência (Hz)' },
  { key: 'carcaca', label: 'Carcaça' },
  { key: 'grauProtecaoIP', label: 'Grau de proteção (IP)' },
  { key: 'fatorServico', label: 'Fator de serviço' },
];

const FLUXO = ['cliente', 'motor', 'placa', 'panoramica', 'dados', 'rebobinado', 'extras', 'resumo'];

function emptyDados() {
  const d = {};
  CAMPOS.forEach((c) => (d[c.key] = ''));
  return d;
}

const state = {
  config: { aiEnabled: false, driveConfigured: false, driveConnected: false, rootFolderName: 'Cadastro de Motores' },
  step: 'start',
  cliente: '',
  motor: '',
  placa: null, // {file, url}
  panoramica: null,
  dados: emptyDados(),
  naoLegiveis: [],
  aiUsed: false,
  vezesRebobinado: '',
  extras: [], // {file, url, name}
  observacoes: '',
  mode: 'create',
  existe: false,
  result: null,
};

const appEl = document.getElementById('app');
const progressEl = document.getElementById('progress');

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 3200);
}

function go(step) {
  state.step = step;
  render();
}

function renderProgress() {
  const idx = FLUXO.indexOf(state.step);
  if (idx < 0) {
    progressEl.hidden = true;
    return;
  }
  progressEl.hidden = false;
  progressEl.innerHTML = FLUXO.map((_, i) => `<span class="${i <= idx ? 'done' : ''}"></span>`).join('');
}

// ---------------------------------------------------------------------------
// Renderização principal
// ---------------------------------------------------------------------------
function render() {
  renderProgress();
  const fn = VIEWS[state.step] || VIEWS.start;
  appEl.innerHTML = '';
  appEl.appendChild(fn());
  window.scrollTo(0, 0);
}

function card(html) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = html;
  return div;
}

// ---------------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------------
const VIEWS = {
  start() {
    const c = state.config;
    const driveBadge = c.driveConnected
      ? '<span class="badge on">✓ Google Drive conectado</span>'
      : c.driveConfigured
        ? '<span class="badge off">Google Drive não conectado</span>'
        : '<span class="badge off">Salvar local + ZIP</span>';
    const aiBadge = c.aiEnabled
      ? '<span class="badge on">✓ Leitura da placa por IA</span>'
      : '<span class="badge off">Entrada manual da placa</span>';

    const el = card(`
      <div class="step-label">Bem-vindo</div>
      <h2>Cadastrar motor em campo</h2>
      <p class="lead">Vou coletar os dados e as fotos do motor e arquivar tudo de forma padronizada. Uma etapa por vez.</p>
      <div class="badges">${aiBadge}${driveBadge}</div>
      <button class="btn btn-primary" id="start">Iniciar cadastro</button>
      ${c.driveConfigured && !c.driveConnected ? '<a class="btn btn-secondary" href="/auth/google" style="margin-top:10px">Conectar Google Drive</a>' : ''}
    `);
    el.querySelector('#start').onclick = () => go('cliente');
    return el;
  },

  cliente() {
    const el = card(`
      <div class="step-label">Etapa 1 de 8</div>
      <h2>Qual é o cliente?</h2>
      <label class="field">
        <span class="lbl">Nome do cliente</span>
        <input type="text" id="cliente" value="${esc(state.cliente)}" placeholder="Ex.: Indústria São José" autofocus />
      </label>
      <button class="btn btn-primary" id="next" disabled>Continuar</button>
    `);
    const input = el.querySelector('#cliente');
    const next = el.querySelector('#next');
    const sync = () => (next.disabled = input.value.trim() === '');
    input.oninput = sync;
    sync();
    next.onclick = () => {
      state.cliente = input.value.trim();
      go('motor');
    };
    return el;
  },

  motor() {
    const el = card(`
      <div class="step-label">Etapa 2 de 8 · ${esc(state.cliente)}</div>
      <h2>Qual é o motor?</h2>
      <label class="field">
        <span class="lbl">Nome do motor</span>
        <input type="text" id="motor" value="${esc(state.motor)}" placeholder='Ex.: Exaustor 03, Bomba do poço 2' autofocus />
      </label>
      <div class="btn-row">
        <button class="btn btn-secondary" id="back">Voltar</button>
        <button class="btn btn-primary" id="next" disabled>Continuar</button>
      </div>
    `);
    const input = el.querySelector('#motor');
    const next = el.querySelector('#next');
    const sync = () => (next.disabled = input.value.trim() === '');
    input.oninput = sync;
    sync();
    el.querySelector('#back').onclick = () => go('cliente');
    next.onclick = () => {
      state.motor = input.value.trim();
      go('placa');
    };
    return el;
  },

  placa() {
    return photoStep({
      label: 'Etapa 3 de 8',
      title: 'Foto da placa de identificação',
      lead: 'Enquadre a placa do motor. Quanto mais nítida, melhor a leitura dos dados.',
      slot: 'placa',
      back: 'motor',
      next: 'panoramica',
    });
  },

  panoramica() {
    return photoStep({
      label: 'Etapa 4 de 8',
      title: 'Foto panorâmica do motor',
      lead: 'Mostre o motor instalado no local, com o ambiente ao redor.',
      slot: 'panoramica',
      back: 'placa',
      next: 'dados',
      onNext: startLeitura,
    });
  },

  lendo() {
    const el = card(`
      <div class="center">
        <div class="spinner"></div>
        <h2>Lendo a placa…</h2>
        <p class="lead">Extraindo os dados do motor a partir da foto.</p>
      </div>
    `);
    return el;
  },

  dados() {
    const flagged = new Set(state.naoLegiveis);
    let aviso = '';
    if (state.aiUsed && flagged.size > 0) {
      aviso = `<div class="note note-warn"><strong>Não consegui ler com segurança:</strong>
        <ul>${[...flagged].map((f) => `<li>${esc(rotulo(f))}</li>`).join('')}</ul>
        Confira na placa e preencha manualmente (ou deixe em branco para "N/D").</div>`;
    } else if (state.aiUsed) {
      aviso = '<div class="note note-info">Confira os dados lidos da placa e ajuste o que precisar.</div>';
    } else {
      aviso = '<div class="note note-info">Preencha os dados conforme a placa. Campos em branco ficam como "N/D".</div>';
    }

    const fields = CAMPOS.map((c) => {
      const flag = flagged.has(c.key) ? 'field-flag' : '';
      return `<label class="field ${flag}">
        <span class="lbl">${c.label}</span>
        <input type="text" data-key="${c.key}" value="${esc(state.dados[c.key])}" />
      </label>`;
    }).join('');

    const el = card(`
      <div class="step-label">Etapa 5 de 8 · Dados da placa</div>
      <h2>Dados do motor</h2>
      ${aviso}
      ${fields}
      <div class="btn-row">
        <button class="btn btn-secondary" id="back">Voltar</button>
        <button class="btn btn-primary" id="next">Continuar</button>
      </div>
    `);
    el.querySelectorAll('input[data-key]').forEach((inp) => {
      inp.oninput = () => (state.dados[inp.dataset.key] = inp.value);
    });
    el.querySelector('#back').onclick = () => go('panoramica');
    el.querySelector('#next').onclick = () => go('rebobinado');
    return el;
  },

  rebobinado() {
    const el = card(`
      <div class="step-label">Etapa 6 de 8</div>
      <h2>Quantas vezes foi rebobinado?</h2>
      <label class="field">
        <span class="lbl">Número de rebobinamentos</span>
        <input type="number" id="reb" min="0" inputmode="numeric" value="${esc(state.vezesRebobinado)}" placeholder="Ex.: 0, 1, 2…" autofocus />
      </label>
      <div class="btn-row">
        <button class="btn btn-secondary" id="back">Voltar</button>
        <button class="btn btn-primary" id="next">Continuar</button>
      </div>
    `);
    const input = el.querySelector('#reb');
    el.querySelector('#back').onclick = () => go('dados');
    el.querySelector('#next').onclick = () => {
      state.vezesRebobinado = input.value.trim();
      go('extras');
    };
    return el;
  },

  extras() {
    const el = card(`
      <div class="step-label">Etapa 7 de 8</div>
      <h2>Fotos adicionais</h2>
      <p class="lead">Opcional. Adicione outras fotos e dê um nome a cada uma.</p>
      <div id="extra-list"></div>
      <input type="file" accept="image/*" capture="environment" class="photo-input" id="extra-input" />
      <button class="btn btn-secondary" id="add">+ Adicionar foto</button>
      <label class="field" style="margin-top:18px">
        <span class="lbl">Observações (opcional)</span>
        <textarea id="obs" placeholder="Anotações sobre o motor…">${esc(state.observacoes)}</textarea>
      </label>
      <div class="btn-row">
        <button class="btn btn-secondary" id="back">Voltar</button>
        <button class="btn btn-primary" id="next">Revisar</button>
      </div>
    `);

    const list = el.querySelector('#extra-list');
    function drawList() {
      list.innerHTML = state.extras
        .map(
          (e, i) => `<div class="extra-item">
            <img src="${e.url}" alt="" />
            <input type="text" data-i="${i}" value="${esc(e.name)}" placeholder="Nome da foto" />
            <button class="del" data-del="${i}" title="Remover">×</button>
          </div>`,
        )
        .join('');
      list.querySelectorAll('input[data-i]').forEach((inp) => {
        inp.oninput = () => (state.extras[inp.dataset.i].name = inp.value);
      });
      list.querySelectorAll('button[data-del]').forEach((b) => {
        b.onclick = () => {
          state.extras.splice(Number(b.dataset.del), 1);
          drawList();
        };
      });
    }
    drawList();

    const fileInput = el.querySelector('#extra-input');
    el.querySelector('#add').onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const f = fileInput.files[0];
      if (f) {
        state.extras.push({ file: f, url: URL.createObjectURL(f), name: '' });
        drawList();
      }
      fileInput.value = '';
    };

    el.querySelector('#obs').oninput = (e) => (state.observacoes = e.target.value);
    el.querySelector('#back').onclick = () => go('rebobinado');
    el.querySelector('#next').onclick = () => {
      state.extras.forEach((e, i) => {
        if (!e.name.trim()) e.name = `Foto adicional ${i + 1}`;
      });
      go('resumo');
    };
    return el;
  },

  resumo() {
    const d = state.dados;
    const linha = (k, v) => {
      const val = (v || '').toString().trim();
      return `<li><span class="k">${k}</span><span class="v ${val ? '' : 'nd'}">${val ? esc(val) : 'N/D'}</span></li>`;
    };
    const potencia = d.potenciaCV
      ? `${d.potenciaCV} CV${d.potenciaKW ? ` (${d.potenciaKW} kW)` : ''}`
      : '';

    const fotos = [];
    if (state.placa) fotos.push('Placa do motor antigo');
    if (state.panoramica) fotos.push('Motor antigo instalado');
    state.extras.forEach((e) => fotos.push(e.name));

    const el = card(`
      <div class="step-label">Etapa 8 de 8 · Confirmação</div>
      <h2>Confira antes de gravar</h2>
      <div id="dup"></div>
      <ul class="summary">
        ${linha('Cliente', state.cliente)}
        ${linha('Motor', state.motor)}
        ${linha('Fabricante / Modelo', [d.fabricante, d.modelo].filter(Boolean).join(' / '))}
        ${linha('Rotação (RPM)', d.rotacaoRPM)}
        ${linha('Potência', potencia)}
        ${linha('Rendimento (%)', d.rendimento)}
        ${linha('Nº de série', d.numeroSerie)}
        ${linha('Ano', d.anoFabricacao)}
        ${linha('Vezes rebobinado', state.vezesRebobinado)}
        ${linha('Tensão (V)', d.tensao)}
        ${linha('Corrente (A)', d.corrente)}
        ${linha('Frequência (Hz)', d.frequencia)}
        ${linha('Carcaça', d.carcaca)}
        ${linha('Grau de proteção (IP)', d.grauProtecaoIP)}
        ${linha('Fator de serviço', d.fatorServico)}
        ${linha('Fotos', fotos.join(', '))}
        ${linha('Observações', state.observacoes)}
      </ul>
      <div class="btn-row">
        <button class="btn btn-secondary" id="back">Voltar</button>
        <button class="btn btn-primary" id="save">Gravar cadastro</button>
      </div>
    `);

    el.querySelector('#back').onclick = () => go('extras');
    el.querySelector('#save').onclick = () => salvar();

    // Verifica duplicidade do motor.
    checkDuplicado(el.querySelector('#dup'));
    return el;
  },

  salvando() {
    return card(`
      <div class="center">
        <div class="spinner"></div>
        <h2>Gravando…</h2>
        <p class="lead">Salvando fotos e dados de forma padronizada.</p>
      </div>
    `);
  },

  sucesso() {
    const r = state.result || {};
    const linkBtn = r.storage === 'drive' && r.link
      ? `<a class="btn btn-primary" href="${esc(r.link)}" target="_blank" rel="noopener">Abrir pasta no Drive</a>`
      : r.link
        ? `<a class="btn btn-primary" href="${esc(r.link)}">Baixar ZIP do cadastro</a>`
        : '';

    const el = card(`
      <div class="success-ico">✅</div>
      <h2 class="center">Cadastro gravado!</h2>
      <p class="lead center">${esc(r.folderPath || '')}</p>
      ${r.storage !== 'drive' ? '<div class="note note-info">Salvo no servidor local. Baixe o ZIP para arquivar no Google Drive.</div>' : ''}
      ${linkBtn}
      <button class="btn btn-secondary" id="mesmo" style="margin-top:10px">Cadastrar outro motor (mesmo cliente)</button>
      <button class="btn btn-ghost" id="novo" style="margin-top:6px">Novo cliente</button>
    `);
    el.querySelector('#mesmo').onclick = () => resetMotor(true);
    el.querySelector('#novo').onclick = () => resetMotor(false);
    return el;
  },
};

// ---------------------------------------------------------------------------
// Componente de foto reutilizável
// ---------------------------------------------------------------------------
function photoStep({ label, title, lead, slot, back, next, onNext }) {
  const current = state[slot];
  const el = card(`
    <div class="step-label">${label}</div>
    <h2>${title}</h2>
    <p class="lead">${lead}</p>
    <div id="ph"></div>
    <input type="file" accept="image/*" capture="environment" class="photo-input" id="file" />
    <div class="btn-row">
      <button class="btn btn-secondary" id="back">Voltar</button>
      <button class="btn btn-primary" id="next" ${current ? '' : 'disabled'}>Continuar</button>
    </div>
  `);

  const ph = el.querySelector('#ph');
  const fileInput = el.querySelector('#file');
  const next$ = el.querySelector('#next');

  function draw() {
    const cur = state[slot];
    if (cur) {
      ph.innerHTML = `<div class="preview"><img src="${cur.url}" alt="" /><button class="retake" id="retake">Trocar foto</button></div>`;
      ph.querySelector('#retake').onclick = () => fileInput.click();
    } else {
      ph.innerHTML = `<div class="photo-drop" id="drop"><span class="ico">📷</span><span>Tirar / escolher foto</span><small>Usa a câmera do celular</small></div>`;
      ph.querySelector('#drop').onclick = () => fileInput.click();
    }
    next$.disabled = !state[slot];
  }
  draw();

  fileInput.onchange = () => {
    const f = fileInput.files[0];
    if (f) {
      if (state[slot]) URL.revokeObjectURL(state[slot].url);
      state[slot] = { file: f, url: URL.createObjectURL(f) };
      draw();
    }
    fileInput.value = '';
  };

  el.querySelector('#back').onclick = () => go(back);
  next$.onclick = () => (onNext ? onNext() : go(next));
  return el;
}

function rotulo(key) {
  const c = CAMPOS.find((x) => x.key === key);
  return c ? c.label : key;
}

// ---------------------------------------------------------------------------
// Ações (rede)
// ---------------------------------------------------------------------------
async function startLeitura() {
  if (!state.config.aiEnabled) {
    state.aiUsed = false;
    state.dados = emptyDados();
    state.naoLegiveis = [];
    return go('dados');
  }
  go('lendo');
  try {
    const fd = new FormData();
    fd.append('placa', state.placa.file, 'placa.jpg');
    const res = await fetch('/api/plate/read', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha na leitura.');
    state.aiUsed = Boolean(data.aiEnabled);
    state.dados = { ...emptyDados(), ...(data.dados || {}) };
    state.naoLegiveis = data.naoLegiveis || [];
  } catch (err) {
    toast('Não foi possível ler a placa: ' + err.message);
    state.aiUsed = false;
    state.dados = emptyDados();
    state.naoLegiveis = [];
  }
  go('dados');
}

async function checkDuplicado(container) {
  try {
    const res = await fetch('/api/motor/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente: state.cliente, motor: state.motor }),
    });
    const data = await res.json();
    state.existe = Boolean(data.exists);
    if (!state.existe) {
      state.mode = 'create';
      return;
    }
    state.mode = state.mode === 'create' ? 'update' : state.mode;
    container.innerHTML = `
      <div class="note note-warn">Já existe uma pasta chamada <strong>${esc(state.motor)}</strong> para este cliente. O que deseja fazer?</div>
      <label class="choice ${state.mode === 'update' ? 'sel' : ''}"><input type="radio" name="mode" value="update" ${state.mode === 'update' ? 'checked' : ''}/> É o mesmo motor — atualizar o cadastro</label>
      <label class="choice ${state.mode === 'new' ? 'sel' : ''}"><input type="radio" name="mode" value="new" ${state.mode === 'new' ? 'checked' : ''}/> É um motor diferente — criar com sufixo de data</label>
    `;
    container.querySelectorAll('input[name="mode"]').forEach((r) => {
      r.onchange = () => {
        state.mode = r.value;
        container.querySelectorAll('.choice').forEach((c) => c.classList.remove('sel'));
        r.closest('.choice').classList.add('sel');
      };
    });
  } catch {
    /* silencioso: segue como novo cadastro */
  }
}

async function salvar() {
  go('salvando');
  try {
    const fd = new FormData();
    if (state.placa) fd.append('placa', state.placa.file, 'placa.jpg');
    if (state.panoramica) fd.append('panoramica', state.panoramica.file, 'panoramica.jpg');
    const extrasNames = [];
    state.extras.forEach((e, i) => {
      fd.append('extras', e.file, `extra-${i}.jpg`);
      extrasNames.push(e.name);
    });
    fd.append(
      'meta',
      JSON.stringify({
        cliente: state.cliente,
        motor: state.motor,
        dados: state.dados,
        vezesRebobinado: state.vezesRebobinado,
        observacoes: state.observacoes,
        extrasNames,
        mode: state.existe ? state.mode : 'create',
      }),
    );

    const res = await fetch('/api/motor/save', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao gravar.');
    state.result = data;
    go('sucesso');
  } catch (err) {
    toast('Erro ao gravar: ' + err.message);
    go('resumo');
  }
}

// ---------------------------------------------------------------------------
// Reset entre motores
// ---------------------------------------------------------------------------
function resetMotor(keepCliente) {
  [state.placa, state.panoramica, ...state.extras].forEach((p) => p && p.url && URL.revokeObjectURL(p.url));
  state.motor = '';
  state.placa = null;
  state.panoramica = null;
  state.dados = emptyDados();
  state.naoLegiveis = [];
  state.aiUsed = false;
  state.vezesRebobinado = '';
  state.extras = [];
  state.observacoes = '';
  state.mode = 'create';
  state.existe = false;
  state.result = null;
  if (!keepCliente) state.cliente = '';
  go(keepCliente ? 'motor' : 'cliente');
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
async function init() {
  try {
    const res = await fetch('/api/config');
    state.config = await res.json();
  } catch {
    /* usa padrões */
  }
  const params = new URLSearchParams(location.search);
  if (params.get('drive') === 'connected') {
    toast('Google Drive conectado com sucesso!');
    history.replaceState({}, '', '/');
  } else if (params.get('drive') === 'error') {
    toast('Não foi possível conectar ao Google Drive.');
    history.replaceState({}, '', '/');
  }
  render();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
}

init();
