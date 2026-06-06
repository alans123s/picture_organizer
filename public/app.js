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
  aiDeferred: false,
  vezesRebobinado: '',
  extras: [], // {file, url, name}
  observacoes: '',
  mode: 'create',
  existe: false,
  result: null,
  pendentes: 0,
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
  toast._t = setTimeout(() => (t.hidden = true), 3600);
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

function rotulo(key) {
  const c = CAMPOS.find((x) => x.key === key);
  return c ? c.label : key;
}

/** Comprime/redimensiona a foto no próprio navegador (não precisa de servidor). */
async function compressImage(file, max = 2000, quality = 0.82) {
  try {
    const bmp = await createImageBitmap(file);
    let { width, height } = bmp;
    const scale = Math.min(1, max / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bmp, 0, 0, width, height);
    bmp.close && bmp.close();
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    return blob || file;
  } catch {
    return file;
  }
}

// ---------------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------------
const VIEWS = {
  start() {
    const c = state.config;
    const offline = !navigator.onLine;
    const driveBadge = c.driveConnected
      ? '<span class="badge on">✓ Google Drive conectado</span>'
      : c.driveConfigured
        ? '<span class="badge off">Google Drive não conectado</span>'
        : '<span class="badge off">Salvar local + ZIP</span>';
    const aiBadge = c.aiEnabled
      ? '<span class="badge on">✓ Leitura da placa por IA</span>'
      : '<span class="badge off">Entrada manual da placa</span>';
    const netBadge = offline ? '<span class="badge off">📴 Offline</span>' : '<span class="badge on">🌐 Online</span>';

    const pend = state.pendentes > 0
      ? `<button class="btn btn-secondary" id="pend" style="margin-top:10px">📥 Pendentes para enviar: ${state.pendentes}</button>`
      : '';

    const el = card(`
      <div class="step-label">Bem-vindo</div>
      <h2>Cadastrar motor em campo</h2>
      <p class="lead">Funciona <strong>offline</strong>: cadastre sem internet que tudo fica salvo no aparelho e é enviado sozinho quando a conexão voltar.</p>
      <div class="badges">${netBadge}${aiBadge}${driveBadge}</div>
      <button class="btn btn-primary" id="start">Iniciar cadastro</button>
      ${pend}
      ${c.driveConfigured && !c.driveConnected && !offline ? '<a class="btn btn-ghost" href="/auth/google" style="margin-top:6px">Conectar Google Drive</a>' : ''}
    `);
    el.querySelector('#start').onclick = () => go('cliente');
    const pb = el.querySelector('#pend');
    if (pb) pb.onclick = () => go('pendentes');
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
    return card(`
      <div class="center">
        <div class="spinner"></div>
        <h2>Lendo a placa…</h2>
        <p class="lead">Extraindo os dados do motor a partir da foto.</p>
      </div>
    `);
  },

  dados() {
    const flagged = new Set(state.naoLegiveis);
    let aviso = '';
    if (state.aiDeferred) {
      aviso = '<div class="note note-warn">📴 Você está offline. Preencha o que conseguir — a leitura automática da placa será feita na sincronização, e os campos em branco viram "N/D".</div>';
    } else if (state.aiUsed && flagged.size > 0) {
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
      <h2>Confira antes de salvar</h2>
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
        <button class="btn btn-primary" id="save">Salvar cadastro</button>
      </div>
    `);

    el.querySelector('#back').onclick = () => go('extras');
    el.querySelector('#save').onclick = () => salvar();

    // Verifica duplicidade no servidor (só quando online).
    if (navigator.onLine) checkDuplicado(el.querySelector('#dup'));
    return el;
  },

  salvando() {
    return card(`
      <div class="center">
        <div class="spinner"></div>
        <h2>Salvando no aparelho…</h2>
        <p class="lead">Guardando fotos e dados localmente.</p>
      </div>
    `);
  },

  sucesso() {
    const r = state.result || {};
    const synced = r.status === 'sincronizado';
    const sd = r.synced || {};
    const status = synced
      ? `<div class="note note-info">✓ Enviado para ${sd.storage === 'drive' ? 'o Google Drive' : 'o servidor'}.</div>`
      : '<div class="note note-warn">⏳ Salvo no aparelho. Será enviado automaticamente quando houver internet.</div>';

    let linkBtn = '';
    if (synced && sd.storage === 'drive' && sd.link) {
      linkBtn = `<a class="btn btn-primary" href="${esc(sd.link)}" target="_blank" rel="noopener">Abrir pasta no Drive</a>`;
    } else if (synced && sd.link) {
      linkBtn = `<a class="btn btn-primary" href="${esc(sd.link)}">Baixar ZIP do cadastro</a>`;
    }

    const el = card(`
      <div class="success-ico">${synced ? '✅' : '💾'}</div>
      <h2 class="center">${synced ? 'Cadastro enviado!' : 'Cadastro salvo no aparelho!'}</h2>
      <p class="lead center">${esc((synced && sd.folderPath) || r.folderPath || '')}</p>
      ${status}
      ${linkBtn}
      <button class="btn btn-secondary" id="mesmo" style="margin-top:10px">Cadastrar outro motor (mesmo cliente)</button>
      <button class="btn btn-ghost" id="novo" style="margin-top:6px">Novo cliente</button>
      ${state.pendentes > 0 ? `<button class="btn btn-ghost" id="pend" style="margin-top:6px">Ver pendentes (${state.pendentes})</button>` : ''}
    `);
    el.querySelector('#mesmo').onclick = () => resetMotor(true);
    el.querySelector('#novo').onclick = () => resetMotor(false);
    const pb = el.querySelector('#pend');
    if (pb) pb.onclick = () => go('pendentes');
    return el;
  },

  pendentes() {
    const offline = !navigator.onLine;
    const el = card(`
      <div class="step-label">Sincronização</div>
      <h2>Cadastros no aparelho</h2>
      ${offline ? '<div class="note note-warn">📴 Sem internet. Os cadastros serão enviados quando a conexão voltar.</div>' : ''}
      <button class="btn btn-primary" id="sync" ${offline ? 'disabled' : ''}>Sincronizar agora</button>
      <div id="lista" style="margin-top:14px"><div class="spinner"></div></div>
      <button class="btn btn-ghost" id="back" style="margin-top:8px">Voltar ao início</button>
    `);
    el.querySelector('#back').onclick = () => go('start');
    el.querySelector('#sync').onclick = async () => {
      toast('Sincronizando…');
      await syncPending();
      toast('Sincronização concluída.');
    };
    preencherLista(el.querySelector('#lista'));
    return el;
  },
};

async function preencherLista(container) {
  let all = [];
  try {
    all = await IDB.getAll();
  } catch {
    /* ignore */
  }
  all.sort((a, b) => b.createdAt - a.createdAt);
  if (all.length === 0) {
    container.innerHTML = '<p class="lead center">Nenhum cadastro no aparelho.</p>';
    return;
  }
  container.innerHTML = `<ul class="summary">${all
    .map((r) => {
      const dt = new Date(r.createdAt).toLocaleString('pt-BR');
      const badge = r.status === 'sincronizado'
        ? '<span class="badge on">enviado</span>'
        : '<span class="badge off">pendente</span>';
      return `<li><span class="k">${esc(r.meta.cliente)} · ${esc(r.meta.motor)}<br><small>${dt}</small></span><span class="v">${badge}</span></li>`;
    })
    .join('')}</ul>`;
}

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

// ---------------------------------------------------------------------------
// Leitura da placa (IA) — só quando online; offline fica para a sincronização
// ---------------------------------------------------------------------------
async function startLeitura() {
  const podeIA = state.config.aiEnabled && navigator.onLine;
  if (!podeIA) {
    state.aiUsed = false;
    state.dados = emptyDados();
    state.naoLegiveis = [];
    // Offline mas o servidor tem IA -> leremos a placa na sincronização.
    state.aiDeferred = state.config.aiEnabled && !navigator.onLine;
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
    state.aiDeferred = false;
    state.dados = { ...emptyDados(), ...(data.dados || {}) };
    state.naoLegiveis = data.naoLegiveis || [];
  } catch (err) {
    toast('Não foi possível ler a placa agora: ' + err.message);
    state.aiUsed = false;
    state.aiDeferred = state.config.aiEnabled;
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
    /* offline ou servidor indisponível: segue como novo cadastro */
  }
}

// ---------------------------------------------------------------------------
// Salvar (sempre local, primeiro) + sincronização
// ---------------------------------------------------------------------------
async function salvar() {
  go('salvando');
  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const placa = state.placa ? await compressImage(state.placa.file) : null;
    const panoramica = state.panoramica ? await compressImage(state.panoramica.file) : null;
    const extras = [];
    for (const e of state.extras) {
      extras.push({ name: e.name, blob: await compressImage(e.file) });
    }

    const record = {
      id,
      createdAt: Date.now(),
      status: 'pendente',
      meta: {
        cliente: state.cliente,
        motor: state.motor,
        dados: state.dados,
        vezesRebobinado: state.vezesRebobinado,
        observacoes: state.observacoes,
        extrasNames: state.extras.map((e) => e.name),
        mode: state.existe ? state.mode : 'create',
        autoLerPlaca: !state.aiUsed, // IA preenche os campos em branco na sincronização
      },
      placa,
      panoramica,
      extras,
    };

    await IDB.add(record);
    state.result = {
      id,
      status: 'pendente',
      folderPath: `${state.config.rootFolderName} › ${state.cliente} › ${state.motor}`,
    };
    go('sucesso');
    await updatePendingBadge();
    trySync(); // tenta enviar em segundo plano se houver internet
  } catch (err) {
    toast('Erro ao salvar no aparelho: ' + err.message);
    go('resumo');
  }
}

let syncing = false;

async function syncPending() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const pend = await IDB.getPending();
    for (const rec of pend) {
      try {
        const fd = new FormData();
        if (rec.placa) fd.append('placa', rec.placa, 'placa.jpg');
        if (rec.panoramica) fd.append('panoramica', rec.panoramica, 'panoramica.jpg');
        (rec.extras || []).forEach((e, i) => {
          if (e.blob) fd.append('extras', e.blob, `extra-${i}.jpg`);
        });
        fd.append('meta', JSON.stringify(rec.meta));

        const res = await fetch('/api/motor/save', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao enviar.');

        // Sucesso: marca como sincronizado e libera as fotos do armazenamento local.
        await IDB.update(rec.id, {
          status: 'sincronizado',
          result: data,
          syncedAt: Date.now(),
          placa: null,
          panoramica: null,
          extras: (rec.extras || []).map((e) => ({ name: e.name })),
        });
        if (state.result && state.result.id === rec.id) {
          state.result.status = 'sincronizado';
          state.result.synced = data;
          if (state.step === 'sucesso') render();
        }
      } catch {
        /* mantém pendente para tentar de novo depois */
      }
    }
  } finally {
    syncing = false;
    await updatePendingBadge();
    if (state.step === 'pendentes') render();
  }
}

function trySync() {
  if (navigator.onLine) syncPending();
}

async function updatePendingBadge() {
  try {
    const pend = await IDB.getPending();
    state.pendentes = pend.length;
  } catch {
    state.pendentes = 0;
  }
  if (['start', 'pendentes', 'sucesso'].includes(state.step)) render();
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
  state.aiDeferred = false;
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
    /* offline: usa padrões e segue funcionando */
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
  await updatePendingBadge();
  trySync();

  window.addEventListener('online', () => {
    toast('Conexão restabelecida — sincronizando…');
    trySync();
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
}

init();
