/**
 * RELATÓRIO DIÁRIO SDR — FAZENDO ACONTECER
 * Aplicação 100% Client-Side (estado exclusivamente em memória temporária)
 */

(function () {
  'use strict';

  // =========================================================================
  // UTILITÁRIOS DE DATA E FORMATAÇÃO
  // =========================================================================

  const WEEKDAYS_PT = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];

  const MONTHS_PT = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro'
  ];

  function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatHeaderTodayDate() {
    const now = new Date();
    const day = now.getDate();
    const month = MONTHS_PT[now.getMonth()];
    const year = now.getFullYear();
    return `${day} de ${month} de ${year}`;
  }

  /**
   * Recebe string YYYY-MM-DD e retorna metadados sem erro de fuso horário
   */
  function parseISODateLocal(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') {
      return parseISODateLocal(getTodayISO());
    }
    const parts = isoStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return parseISODateLocal(getTodayISO());
    }
    const [year, month, day] = parts;
    const dateObj = new Date(year, month - 1, day);
    const weekday = WEEKDAYS_PT[dateObj.getDay()] || '';
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);

    return {
      weekday,
      dd,
      mm,
      yyyy,
      shortDate: `${dd}/${mm}`,
      fullFormatted: `${weekday} – ${dd}/${mm}`,
      fileDate: `${dd}-${mm}-${yyyy}`
    };
  }

  function toNonNegativeInt(val) {
    if (val === '' || val === null || val === undefined) return 0;
    const parsed = parseInt(String(val).replace(/\D+/g, ''), 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) return 0;
    return parsed;
  }

  function sanitizeNumericString(val) {
    if (val === '' || val === null || val === undefined) return '';
    const digits = String(val).replace(/\D+/g, '');
    if (digits === '') return '';
    return String(parseInt(digits, 10));
  }

  function calcConversionRate(consultas, totalLeads) {
    const c = toNonNegativeInt(consultas);
    const l = toNonNegativeInt(totalLeads);
    if (l <= 0) return '0,00%';
    const rate = (c / l) * 100;
    if (!Number.isFinite(rate) || Number.isNaN(rate) || rate < 0) {
      return '0,00%';
    }
    return rate.toFixed(2).replace('.', ',') + '%';
  }

  function formatLeadsPlural(val) {
    const n = toNonNegativeInt(val);
    return n === 1 ? '1 lead' : `${n} leads`;
  }

  function formatLeadsRecebidosPlural(val) {
    const n = toNonNegativeInt(val);
    return n === 1 ? '1 lead recebido' : `${n} leads recebidos`;
  }

  function formatConsultasPluralLine(val) {
    const n = toNonNegativeInt(val);
    return n === 1 ? '1 consulta agendada' : `${n} consultas agendadas`;
  }

  function formatConsultasFunnel(val) {
    const n = toNonNegativeInt(val);
    if (n === 0) {
      return {
        label: 'Consulta agendada',
        value: 'Nenhuma',
        isZero: true
      };
    }
    if (n === 1) {
      return {
        label: 'Consulta agendada',
        value: '1',
        isZero: false
      };
    }
    return {
      label: 'Consultas agendadas',
      value: String(n),
      isZero: false
    };
  }

  function formatObservationParentheses(obs) {
    if (!obs || typeof obs !== 'string') return '';
    const trimmed = obs.trim();
    if (!trimmed) return '';
    const stripped = trimmed.replace(/^\(+|\)+$/g, '').trim();
    return stripped ? `(${stripped})` : '';
  }

  function normalizeFilenameSlug(text) {
    if (!text || typeof text !== 'string') return 'sdr';
    const slug = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'sdr';
  }

  function buildReportFilename(sdrName, isoDate) {
    const slug = normalizeFilenameSlug(sdrName);
    const dateMeta = parseISODateLocal(isoDate);
    return `relatorio-sdr-${slug}-${dateMeta.fileDate}.jpg`;
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // =========================================================================
  // ESTADO EM MEMÓRIA TEMPORÁRIA (NÃO PERSISTIDO)
  // =========================================================================

  let opCounter = 1;

  function createEmptyOperation(overrides = {}) {
    return {
      id: `op-${Date.now()}-${opCounter++}`,
      name: '',
      totalLeads: '',
      pontosContato: '',
      leadFrio: '',
      leadFrioObs: '',
      qualificacao: '',
      comentarios: '',
      indicacoes: '',
      direct: '',
      consultasAgendadas: '',
      ...overrides
    };
  }

  const state = {
    sdrName: '',
    reportDate: getTodayISO(),
    operations: [createEmptyOperation()]
  };

  // Cache temporário do último canvas gerado para cópia instantânea no clipboard
  let cachedCanvasPromise = null;

  const logoImageEl = new Image();
  logoImageEl.src = 'assets/logo-fazendo-acontecer.png';

  // =========================================================================
  // ELEMENTOS DO DOM
  // =========================================================================

  const dom = {
    headerCurrentDate: document.getElementById('header-current-date'),
    viewForm: document.getElementById('view-form'),
    viewPreview: document.getElementById('view-preview'),
    form: document.getElementById('sdr-report-form'),
    sdrNameInput: document.getElementById('sdr-name'),
    errorSdrName: document.getElementById('error-sdr-name'),
    reportDateInput: document.getElementById('report-date'),
    btnSetToday: document.getElementById('btn-set-today'),
    dateFormattedPreview: document.getElementById('date-formatted-preview'),
    operationsContainer: document.getElementById('operations-container'),
    btnAddOperation: document.getElementById('btn-add-operation'),
    btnFillExample: document.getElementById('btn-fill-example'),

    summaryTotalLeads: document.getElementById('summary-total-leads'),
    summaryLeadsSub: document.getElementById('summary-leads-sub'),
    summaryTotalFollowups: document.getElementById('summary-total-followups'),
    summaryTotalConsultas: document.getElementById('summary-total-consultas'),
    summaryConsultasSub: document.getElementById('summary-consultas-sub'),
    summaryTotalConversao: document.getElementById('summary-total-conversao'),

    btnBackEdit: document.getElementById('btn-back-edit'),
    btnNewReport: document.getElementById('btn-new-report'),
    btnCopyImage: document.getElementById('btn-copy-image'),
    copyBtnLabel: document.getElementById('copy-btn-label'),
    btnDownloadJpg: document.getElementById('btn-download-jpg'),
    downloadBtnLabel: document.getElementById('download-btn-label'),
    clipboardAlert: document.getElementById('clipboard-alert'),
    previewFilenameHint: document.getElementById('preview-filename-hint'),

    reportScaleViewport: document.getElementById('report-scale-viewport'),
    reportScaleHolder: document.getElementById('report-scale-holder'),
    reportCaptureTarget: document.getElementById('report-capture-target'),

    confirmModal: document.getElementById('confirm-modal'),
    btnModalCancel: document.getElementById('btn-modal-cancel'),
    btnModalConfirm: document.getElementById('btn-modal-confirm')
  };

  // =========================================================================
  // ÍCONES SVG MINIMALISTAS PARA O RELATÓRIO E FORMULÁRIO
  // =========================================================================

  const ICONS = {
    leadFrio: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" fill="#F4C542"/></svg>`,
    qualificacao: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    comentarios: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    indicacoes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    direct: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    consulta: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
  };

  // =========================================================================
  // RENDERIZAÇÃO DAS OPERAÇÕES NO FORMULÁRIO
  // =========================================================================

  function renderOperationsList() {
    const canDelete = state.operations.length > 1;

    dom.operationsContainer.innerHTML = state.operations
      .map((op, index) => {
        const opNumber = index + 1;
        const rate = calcConversionRate(op.consultasAgendadas, op.totalLeads);
        const consultasCount = toNonNegativeInt(op.consultasAgendadas);
        const leadsCount = toNonNegativeInt(op.totalLeads);
        const detailText = `${formatConsultasPluralLine(consultasCount)} / ${formatLeadsPlural(leadsCount)}`;

        return `
          <div class="operation-card" data-op-id="${op.id}">
            <!-- CABEÇALHO DA OPERAÇÃO -->
            <div class="operation-card-header">
              <div class="operation-badge-group">
                <span class="operation-index-badge">OPERAÇÃO ${opNumber}</span>
                <span class="operation-name-live" data-role="op-live-title">${escapeHTML(op.name || 'Nova Operação')}</span>
              </div>

              <div class="operation-actions">
                <button
                  type="button"
                  class="btn-op-action"
                  data-action="duplicate-op"
                  data-op-id="${op.id}"
                  title="Duplicar esta operação"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Duplicar</span>
                </button>

                <button
                  type="button"
                  class="btn-op-action btn-op-delete"
                  data-action="delete-op"
                  data-op-id="${op.id}"
                  ${!canDelete ? 'disabled title="O relatório precisa ter pelo menos uma operação"' : 'title="Excluir esta operação"'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  <span>Excluir</span>
                </button>
              </div>
            </div>

            <!-- NOME DA OPERAÇÃO -->
            <div class="field-group">
              <label class="field-label" for="op-name-${op.id}">NOME DA OPERAÇÃO</label>
              <input
                type="text"
                id="op-name-${op.id}"
                class="form-input"
                data-field="name"
                data-op-id="${op.id}"
                placeholder="Ex: FERNANDO SILVEIRA"
                value="${escapeHTML(op.name)}"
                autocomplete="off"
                maxlength="80"
              />
              <span class="field-error" data-error-for="op-name-${op.id}" hidden>Preencha o nome desta operação.</span>
            </div>

            <!-- BLOCO 1: INDICADORES DO DIA -->
            <div class="op-subblock">
              <div class="op-subblock-header">
                <div class="op-subblock-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <div class="op-subblock-title">INDICADORES DO DIA</div>
                  <div class="op-subblock-subtitle">Volume de entrada de leads e esforço ativo de contato</div>
                </div>
              </div>

              <div class="metrics-grid-2">
                <div class="field-group">
                  <label class="field-label" for="op-totalLeads-${op.id}">TOTAL DE LEADS</label>
                  <div class="numeric-input-box">
                    <span class="numeric-prefix">#</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      id="op-totalLeads-${op.id}"
                      class="form-input numeric-input"
                      data-field="totalLeads"
                      data-numeric="true"
                      data-op-id="${op.id}"
                      placeholder="0"
                      value="${escapeHTML(op.totalLeads)}"
                      autocomplete="off"
                    />
                  </div>
                </div>

                <div class="field-group">
                  <label class="field-label" for="op-pontosContato-${op.id}">PONTOS DE CONTATO / FOLLOW-UPS</label>
                  <div class="numeric-input-box">
                    <span class="numeric-prefix">#</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      id="op-pontosContato-${op.id}"
                      class="form-input numeric-input"
                      data-field="pontosContato"
                      data-numeric="true"
                      data-op-id="${op.id}"
                      placeholder="0"
                      value="${escapeHTML(op.pontosContato)}"
                      autocomplete="off"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- BLOCO 2: EVOLUÇÃO DO FUNIL -->
            <div class="op-subblock">
              <div class="op-subblock-header">
                <div class="op-subblock-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                </div>
                <div>
                  <div class="op-subblock-title">EVOLUÇÃO DO FUNIL</div>
                  <div class="op-subblock-subtitle">Distribuição dos leads por etapa e agendamentos realizados</div>
                </div>
              </div>

              <div class="metrics-grid-3">
                <!-- LEAD FRIO -->
                <div class="field-group">
                  <label class="field-label" for="op-leadFrio-${op.id}">
                    <span style="color: #F4C542;">●</span> LEAD FRIO
                  </label>
                  <div class="numeric-input-box">
                    <span class="numeric-prefix">#</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      id="op-leadFrio-${op.id}"
                      class="form-input numeric-input"
                      data-field="leadFrio"
                      data-numeric="true"
                      data-op-id="${op.id}"
                      placeholder="0"
                      value="${escapeHTML(op.leadFrio)}"
                      autocomplete="off"
                    />
                  </div>
                </div>

                <!-- QUALIFICAÇÃO -->
                <div class="field-group">
                  <label class="field-label" for="op-qualificacao-${op.id}">QUALIFICAÇÃO</label>
                  <div class="numeric-input-box">
                    <span class="numeric-prefix">#</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      id="op-qualificacao-${op.id}"
                      class="form-input numeric-input"
                      data-field="qualificacao"
                      data-numeric="true"
                      data-op-id="${op.id}"
                      placeholder="0"
                      value="${escapeHTML(op.qualificacao)}"
                      autocomplete="off"
                    />
                  </div>
                </div>

                <!-- COMENTÁRIOS -->
                <div class="field-group">
                  <label class="field-label" for="op-comentarios-${op.id}">COMENTÁRIOS</label>
                  <div class="numeric-input-box">
                    <span class="numeric-prefix">#</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      id="op-comentarios-${op.id}"
                      class="form-input numeric-input"
                      data-field="comentarios"
                      data-numeric="true"
                      data-op-id="${op.id}"
                      placeholder="0"
                      value="${escapeHTML(op.comentarios)}"
                      autocomplete="off"
                    />
                  </div>
                </div>

                <!-- INDICAÇÕES -->
                <div class="field-group">
                  <label class="field-label" for="op-indicacoes-${op.id}">INDICAÇÕES</label>
                  <div class="numeric-input-box">
                    <span class="numeric-prefix">#</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      id="op-indicacoes-${op.id}"
                      class="form-input numeric-input"
                      data-field="indicacoes"
                      data-numeric="true"
                      data-op-id="${op.id}"
                      placeholder="0"
                      value="${escapeHTML(op.indicacoes)}"
                      autocomplete="off"
                    />
                  </div>
                </div>

                <!-- DIRECT -->
                <div class="field-group">
                  <label class="field-label" for="op-direct-${op.id}">DIRECT</label>
                  <div class="numeric-input-box">
                    <span class="numeric-prefix">#</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      id="op-direct-${op.id}"
                      class="form-input numeric-input"
                      data-field="direct"
                      data-numeric="true"
                      data-op-id="${op.id}"
                      placeholder="0"
                      value="${escapeHTML(op.direct)}"
                      autocomplete="off"
                    />
                  </div>
                </div>

                <!-- CONSULTAS AGENDADAS -->
                <div class="field-group">
                  <label class="field-label" for="op-consultasAgendadas-${op.id}">
                    <span style="color: #CEFF29;">✓</span> CONSULTAS AGENDADAS
                  </label>
                  <div class="numeric-input-box">
                    <span class="numeric-prefix">#</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      id="op-consultasAgendadas-${op.id}"
                      class="form-input numeric-input"
                      data-field="consultasAgendadas"
                      data-numeric="true"
                      data-op-id="${op.id}"
                      placeholder="0"
                      value="${escapeHTML(op.consultasAgendadas)}"
                      autocomplete="off"
                    />
                  </div>
                </div>
              </div>

              <!-- OBSERVAÇÃO DO LEAD FRIO -->
              <div class="lead-frio-note-row">
                <label class="lead-frio-note-label" for="op-leadFrioObs-${op.id}">
                  <span>● OBSERVAÇÃO DO LEAD FRIO</span>
                  <span class="optional-tag">(opcional — ex: chegou às 22h42 do dia 27/07)</span>
                </label>
                <input
                  type="text"
                  id="op-leadFrioObs-${op.id}"
                  class="form-input input-note"
                  data-field="leadFrioObs"
                  data-op-id="${op.id}"
                  placeholder="Ex: chegou às 22h42 do dia 27/07"
                  value="${escapeHTML(op.leadFrioObs)}"
                  autocomplete="off"
                  maxlength="120"
                />
              </div>
            </div>

            <!-- TAXA DE CONVERSÃO DIÁRIA DA OPERAÇÃO -->
            <div class="op-conversion-bar">
              <div class="op-conversion-left">
                <span class="op-conversion-title">TAXA DE CONVERSÃO DIÁRIA</span>
                <span class="op-conversion-detail" data-role="op-conv-detail">${detailText}</span>
              </div>
              <div class="op-conversion-value" data-role="op-conv-rate">${rate}</div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // =========================================================================
  // ATUALIZAÇÃO EM TEMPO REAL (CONVERSÃO POR OPERAÇÃO + RESUMO GERAL)
  // =========================================================================

  function updateOperationCalculatedUI(opId) {
    const op = state.operations.find((item) => item.id === opId);
    if (!op) return;

    const card = dom.operationsContainer.querySelector(`.operation-card[data-op-id="${opId}"]`);
    if (!card) return;

    const liveTitle = card.querySelector('[data-role="op-live-title"]');
    if (liveTitle) {
      liveTitle.textContent = op.name.trim() || 'Nova Operação';
    }

    const rateEl = card.querySelector('[data-role="op-conv-rate"]');
    const detailEl = card.querySelector('[data-role="op-conv-detail"]');

    const consultasCount = toNonNegativeInt(op.consultasAgendadas);
    const leadsCount = toNonNegativeInt(op.totalLeads);

    if (rateEl) {
      rateEl.textContent = calcConversionRate(consultasCount, leadsCount);
    }
    if (detailEl) {
      detailEl.textContent = `${formatConsultasPluralLine(consultasCount)} / ${formatLeadsPlural(leadsCount)}`;
    }
  }

  function updateSummaryUI() {
    let totalLeads = 0;
    let totalFollowups = 0;
    let totalConsultas = 0;

    for (const op of state.operations) {
      totalLeads += toNonNegativeInt(op.totalLeads);
      totalFollowups += toNonNegativeInt(op.pontosContato);
      totalConsultas += toNonNegativeInt(op.consultasAgendadas);
    }

    const taxaGeral = calcConversionRate(totalConsultas, totalLeads);

    dom.summaryTotalLeads.textContent = String(totalLeads);
    dom.summaryLeadsSub.textContent = formatLeadsRecebidosPlural(totalLeads);

    dom.summaryTotalFollowups.textContent = String(totalFollowups);

    dom.summaryTotalConsultas.textContent = String(totalConsultas);
    dom.summaryConsultasSub.textContent =
      totalConsultas === 0
        ? 'Nenhuma agendada'
        : totalConsultas === 1
        ? '1 consulta agendada'
        : `${totalConsultas} consultas agendadas`;

    dom.summaryTotalConversao.textContent = taxaGeral;
  }

  function updateDatePreviewUI() {
    const meta = parseISODateLocal(state.reportDate);
    dom.dateFormattedPreview.textContent = meta.fullFormatted;
  }

  // =========================================================================
  // VALIDAÇÃO DO FORMULÁRIO
  // =========================================================================

  function validateForm() {
    let isValid = true;
    let firstInvalidEl = null;

    // 1. Validar SDR
    const sdrTrimmed = state.sdrName.trim();
    if (!sdrTrimmed) {
      isValid = false;
      dom.sdrNameInput.classList.add('input-error');
      dom.errorSdrName.hidden = false;
      firstInvalidEl = dom.sdrNameInput;
    } else {
      dom.sdrNameInput.classList.remove('input-error');
      dom.errorSdrName.hidden = true;
    }

    // 2. Validar Nome de cada Operação
    for (const op of state.operations) {
      const inputEl = document.getElementById(`op-name-${op.id}`);
      const errorEl = dom.operationsContainer.querySelector(`[data-error-for="op-name-${op.id}"]`);
      if (!op.name.trim()) {
        isValid = false;
        if (inputEl) inputEl.classList.add('input-error');
        if (errorEl) errorEl.hidden = false;
        if (!firstInvalidEl && inputEl) firstInvalidEl = inputEl;
      } else {
        if (inputEl) inputEl.classList.remove('input-error');
        if (errorEl) errorEl.hidden = true;
      }
    }

    if (!isValid && firstInvalidEl) {
      firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalidEl.focus();
    }

    return isValid;
  }

  // =========================================================================
  // MONTAGEM DO COMPONENTE VISUAL DO RELATÓRIO (1080PX)
  // =========================================================================

  function renderReportGraphicDOM() {
    const sdrUpper = (state.sdrName.trim() || 'SDR').toUpperCase();
    const dateMeta = parseISODateLocal(state.reportDate);

    let totalLeadsAll = 0;
    let totalFollowupsAll = 0;
    let totalConsultasAll = 0;

    const operationsHTML = state.operations
      .map((op, idx) => {
        const opNameUpper = (op.name.trim() || `OPERAÇÃO ${idx + 1}`).toUpperCase();
        const totalLeads = toNonNegativeInt(op.totalLeads);
        const pontosContato = toNonNegativeInt(op.pontosContato);
        const leadFrio = toNonNegativeInt(op.leadFrio);
        const leadFrioObsFormatted = formatObservationParentheses(op.leadFrioObs);
        const qualificacao = toNonNegativeInt(op.qualificacao);
        const comentarios = toNonNegativeInt(op.comentarios);
        const indicacoes = toNonNegativeInt(op.indicacoes);
        const direct = toNonNegativeInt(op.direct);
        const consultas = toNonNegativeInt(op.consultasAgendadas);

        totalLeadsAll += totalLeads;
        totalFollowupsAll += pontosContato;
        totalConsultasAll += consultas;

        const consultasFunnel = formatConsultasFunnel(consultas);
        const opRate = calcConversionRate(consultas, totalLeads);

        return `
          <div class="rg-operation-card">
            <div class="rg-op-header">
              <div class="rg-op-title-wrap">
                <span class="rg-op-eyebrow">OPERAÇÃO</span>
                <h3 class="rg-op-name">${escapeHTML(opNameUpper)}</h3>
              </div>
              <span class="rg-op-pill">OPERAÇÃO ${String(idx + 1).padStart(2, '0')}</span>
            </div>

            <!-- INDICADORES DO DIA -->
            <div class="rg-section-block">
              <div class="rg-section-label">INDICADORES DO DIA</div>
              <div class="rg-kpi-pair">
                <div class="rg-kpi-card">
                  <span class="rg-kpi-title">TOTAL DE LEADS</span>
                  <strong class="rg-kpi-number">${totalLeads}</strong>
                  <span class="rg-kpi-desc">${formatLeadsRecebidosPlural(totalLeads)} no dia</span>
                </div>

                <div class="rg-kpi-card">
                  <span class="rg-kpi-title">PONTOS DE CONTATO</span>
                  <strong class="rg-kpi-number">${pontosContato}</strong>
                  <span class="rg-kpi-desc">Follow-ups e interações ativas</span>
                </div>
              </div>
            </div>

            <!-- EVOLUÇÃO DO FUNIL -->
            <div class="rg-section-block">
              <div class="rg-section-label">EVOLUÇÃO DO FUNIL</div>
              <div class="rg-funnel-grid">
                <!-- Lead Frio -->
                <div class="rg-funnel-item ${leadFrioObsFormatted ? 'rg-funnel-item-full' : ''}">
                  <div class="rg-funnel-left">
                    <div class="rg-funnel-icon icon-yellow">${ICONS.leadFrio}</div>
                    <div class="rg-funnel-texts">
                      <span class="rg-funnel-name">Lead frio</span>
                      ${
                        leadFrioObsFormatted
                          ? `<span class="rg-funnel-note">${escapeHTML(leadFrioObsFormatted)}</span>`
                          : ''
                      }
                    </div>
                  </div>
                  <strong class="rg-funnel-value">${formatLeadsPlural(leadFrio)}</strong>
                </div>

                <!-- Qualificação -->
                <div class="rg-funnel-item">
                  <div class="rg-funnel-left">
                    <div class="rg-funnel-icon icon-neutral">${ICONS.qualificacao}</div>
                    <div class="rg-funnel-texts">
                      <span class="rg-funnel-name">Qualificação</span>
                    </div>
                  </div>
                  <strong class="rg-funnel-value">${formatLeadsPlural(qualificacao)}</strong>
                </div>

                <!-- Comentários -->
                <div class="rg-funnel-item">
                  <div class="rg-funnel-left">
                    <div class="rg-funnel-icon icon-neutral">${ICONS.comentarios}</div>
                    <div class="rg-funnel-texts">
                      <span class="rg-funnel-name">Comentários</span>
                    </div>
                  </div>
                  <strong class="rg-funnel-value">${formatLeadsPlural(comentarios)}</strong>
                </div>

                <!-- Indicações -->
                <div class="rg-funnel-item">
                  <div class="rg-funnel-left">
                    <div class="rg-funnel-icon icon-neutral">${ICONS.indicacoes}</div>
                    <div class="rg-funnel-texts">
                      <span class="rg-funnel-name">Indicações</span>
                    </div>
                  </div>
                  <strong class="rg-funnel-value">${formatLeadsPlural(indicacoes)}</strong>
                </div>

                <!-- Direct -->
                <div class="rg-funnel-item">
                  <div class="rg-funnel-left">
                    <div class="rg-funnel-icon icon-neutral">${ICONS.direct}</div>
                    <div class="rg-funnel-texts">
                      <span class="rg-funnel-name">Direct</span>
                    </div>
                  </div>
                  <strong class="rg-funnel-value">${formatLeadsPlural(direct)}</strong>
                </div>

                <!-- Consultas Agendadas -->
                <div class="rg-funnel-item rg-funnel-item-consulta ${leadFrioObsFormatted ? 'rg-funnel-item-full' : ''}">
                  <div class="rg-funnel-left">
                    <div class="rg-funnel-icon icon-green">${ICONS.consulta}</div>
                    <div class="rg-funnel-texts">
                      <span class="rg-funnel-name">${escapeHTML(consultasFunnel.label)}</span>
                    </div>
                  </div>
                  <strong class="rg-funnel-value ${consultasFunnel.isZero ? 'val-muted' : 'val-green'}">${escapeHTML(consultasFunnel.value)}</strong>
                </div>
              </div>
            </div>

            <!-- TAXA DE CONVERSÃO DIÁRIA -->
            <div class="rg-conversion-card">
              <div class="rg-conv-left">
                <span class="rg-conv-label">TAXA DE CONVERSÃO DIÁRIA</span>
                <div class="rg-conv-meta">
                  <span>${formatConsultasPluralLine(consultas)}</span>
                  <span class="rg-conv-meta-dot"></span>
                  <span>${formatLeadsRecebidosPlural(totalLeads)}</span>
                </div>
              </div>
              <strong class="rg-conv-number">${opRate}</strong>
            </div>
          </div>
        `;
      })
      .join('');

    const totalRateAll = calcConversionRate(totalConsultasAll, totalLeadsAll);

    dom.reportCaptureTarget.innerHTML = `
      <!-- HEADER DO RELATÓRIO -->
      <div class="rg-header-card">
        <div class="rg-header-top">
          <div class="rg-brand">
            <img
              src="assets/logo-fazendo-acontecer.png"
              alt="Fazendo Acontecer"
              class="rg-brand-logo-img"
            />
          </div>
          <span class="rg-doc-badge">RELATÓRIO DIÁRIO SDR</span>
        </div>

        <div class="rg-meta-grid">
          <div class="rg-meta-box">
            <span class="rg-meta-label">SDR RESPONSÁVEL</span>
            <strong class="rg-meta-value-sdr">${escapeHTML(sdrUpper)}</strong>
          </div>
          <div class="rg-meta-box">
            <span class="rg-meta-label">DATA DO RELATÓRIO</span>
            <strong class="rg-meta-value-date">${escapeHTML(dateMeta.fullFormatted)}</strong>
          </div>
        </div>
      </div>

      <!-- LISTA DE OPERAÇÕES -->
      ${operationsHTML}

      <!-- RESUMO DO DIA -->
      <div class="rg-summary-section">
        <div class="rg-summary-header">
          <h4 class="rg-summary-title">RESUMO DO DIA</h4>
          <span class="rg-summary-subtitle">Consolidado de ${state.operations.length === 1 ? '1 operação' : `${state.operations.length} operações`}</span>
        </div>

        <div class="rg-summary-grid">
          <div class="rg-sum-box">
            <span class="rg-sum-label">LEADS</span>
            <strong class="rg-sum-val">${totalLeadsAll}</strong>
          </div>

          <div class="rg-sum-box">
            <span class="rg-sum-label">FOLLOW-UPS</span>
            <strong class="rg-sum-val">${totalFollowupsAll}</strong>
          </div>

          <div class="rg-sum-box">
            <span class="rg-sum-label">CONSULTAS</span>
            <strong class="rg-sum-val">${totalConsultasAll}</strong>
          </div>

          <div class="rg-sum-box rg-sum-box-green">
            <span class="rg-sum-label">CONVERSÃO</span>
            <strong class="rg-sum-val">${totalRateAll}</strong>
          </div>
        </div>
      </div>

      <!-- FOOTER ASSINATURA -->
      <div class="rg-footer">
        <div class="rg-footer-brand">
          <span class="rg-footer-dot"></span>
          <span>Fazendo Acontecer</span>
        </div>
        <span>Performance Comercial</span>
      </div>
    `;

    dom.previewFilenameHint.textContent = buildReportFilename(state.sdrName, state.reportDate);
  }

  /**
   * Ajusta a escala visual da prévia de 1080px para caber perfeitamente em qualquer tela
   */
  function updatePreviewScale() {
    if (dom.viewPreview.hidden) return;
    const viewportWidth = dom.reportScaleViewport.clientWidth;
    if (!viewportWidth) return;

    const baseWidth = 1080;
    const scale = Math.min(1, viewportWidth / baseWidth);
    dom.reportScaleHolder.style.transform = `scale(${scale})`;

    const naturalHeight = dom.reportCaptureTarget.offsetHeight;
    dom.reportScaleViewport.style.height = `${Math.ceil(naturalHeight * scale)}px`;
  }

  // =========================================================================
  // MOTOR DE RENDERIZAÇÃO DE IMAGEM (1080PX HD, PIXEL RATIO 2)
  // Combina html-to-image + Renderizador Canvas 2D Nativo de Alta Precisão
  // =========================================================================

  function drawRoundedRect(ctx, x, y, w, h, r, fillStyle, strokeStyle, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Renderizador Canvas 2D Nativo (1080px base @ pixelRatio 2 = 2160px largura)
   * Garante exportação 100% livre de falhas de CORS/foreignObject em qualquer navegador ou protocolo file://
   */
  function renderReportViaNativeCanvas2D() {
    const scale = 2; // pixelRatio 2 (Alta Definição)
    const W = 1080;
    const PAD = 60;
    const innerW = W - PAD * 2; // 960px

    const sdrUpper = (state.sdrName.trim() || 'SDR').toUpperCase();
    const dateMeta = parseISODateLocal(state.reportDate);

    // Calcular altura total dinâmica antes de desenhar
    let totalHeight = PAD; // top padding
    const headerH = 250;
    totalHeight += headerH + 36; // header card + gap

    const opHeights = state.operations.map((op) => {
      const hasObs = Boolean(formatObservationParentheses(op.leadFrioObs));
      // 4 linhas de funil se tiver observação, senão 3 linhas (2 colunas)
      const funnelH = hasObs ? 4 * 82 + 3 * 14 : 3 * 82 + 2 * 14;
      return 40 + 68 + 30 + (30 + 140) + 30 + (30 + funnelH) + 30 + 106 + 40;
    });

    for (const h of opHeights) {
      totalHeight += h + 36;
    }

    const summaryH = 228;
    totalHeight += summaryH + 36;
    const footerH = 34;
    totalHeight += footerH + PAD;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = totalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const FONT_SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif';
    const FONT_DISPLAY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';

    // Background Geral
    ctx.fillStyle = '#0B0D10';
    ctx.fillRect(0, 0, W, totalHeight);

    let curY = PAD;

    // 1. HEADER CARD
    drawRoundedRect(ctx, PAD, curY, innerW, headerH, 24, '#13161B', '#232730', 1);

    // Logo box
    const hx = PAD + 44;
    const hy = curY + 36;
    if (logoImageEl.complete && logoImageEl.naturalWidth > 0) {
      const targetH = 42;
      const targetW = (logoImageEl.naturalWidth / logoImageEl.naturalHeight) * targetH;
      ctx.drawImage(logoImageEl, hx, hy + 3, targetW, targetH);
    } else {
      drawRoundedRect(ctx, hx, hy, 46, 46, 11, '#CEFF29', null);
      ctx.strokeStyle = '#0B0D10';
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      const cx = hx + 23;
      const cy = hy + 23;
      const rays = [
        [0, -13, 0, -4],
        [0, 4, 0, 13],
        [-13, 0, -4, 0],
        [4, 0, 13, 0],
        [-9, -9, -3, -3],
        [3, 3, 9, 9],
        [9, -9, 3, -3],
        [-3, 3, -9, 9]
      ];
      for (const [x1, y1, x2, y2] of rays) {
        ctx.beginPath();
        ctx.moveTo(cx + x1, cy + y1);
        ctx.lineTo(cx + x2, cy + y2);
        ctx.stroke();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 18px ${FONT_DISPLAY}`;
      ctx.fillText('FAZENDO', hx + 62, hy + 20);
      ctx.fillText('ACONTECER', hx + 62, hy + 40);
    }

    // Badge RELATÓRIO DIÁRIO SDR
    const badgeW = 240;
    const badgeH = 38;
    const badgeX = PAD + innerW - 44 - badgeW;
    const badgeY = hy + 5;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 19, '#162816', '#2B5027', 1);
    ctx.fillStyle = '#CEFF29';
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('RELATÓRIO DIÁRIO SDR', badgeX + badgeW / 2, badgeY + 24);
    ctx.textAlign = 'left';

    // Divider line
    ctx.strokeStyle = '#22262E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 72);
    ctx.lineTo(PAD + innerW - 44, hy + 72);
    ctx.stroke();

    // Meta boxes (SDR & Data)
    const metaY = hy + 96;
    const metaH = 92;
    const box1W = 460;
    const box2W = innerW - 88 - box1W - 20;
    drawRoundedRect(ctx, hx, metaY, box1W, metaH, 16, '#0E1116', '#20242C', 1);
    drawRoundedRect(ctx, hx + box1W + 20, metaY, box2W, metaH, 16, '#0E1116', '#20242C', 1);

    ctx.fillStyle = '#8A919E';
    ctx.font = `600 12px ${FONT_SANS}`;
    ctx.fillText('SDR RESPONSÁVEL', hx + 24, metaY + 30);
    ctx.fillText('DATA DO RELATÓRIO', hx + box1W + 44, metaY + 30);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 30px ${FONT_DISPLAY}`;
    ctx.fillText(sdrUpper.slice(0, 24), hx + 24, metaY + 68);

    ctx.fillStyle = '#CEFF29';
    ctx.font = `600 25px ${FONT_DISPLAY}`;
    ctx.fillText(dateMeta.fullFormatted, hx + box1W + 44, metaY + 67);

    curY += headerH + 36;

    // 2. OPERAÇÕES
    let totalLeadsAll = 0;
    let totalFollowupsAll = 0;
    let totalConsultasAll = 0;

    state.operations.forEach((op, idx) => {
      const opH = opHeights[idx];
      drawRoundedRect(ctx, PAD, curY, innerW, opH, 24, '#13161B', '#232730', 1);

      const ox = PAD + 44;
      let oy = curY + 40;
      const contentW = innerW - 88; // 872px

      const opNameUpper = (op.name.trim() || `OPERAÇÃO ${idx + 1}`).toUpperCase();
      const totalLeads = toNonNegativeInt(op.totalLeads);
      const pontosContato = toNonNegativeInt(op.pontosContato);
      const leadFrio = toNonNegativeInt(op.leadFrio);
      const leadFrioObs = formatObservationParentheses(op.leadFrioObs);
      const qualificacao = toNonNegativeInt(op.qualificacao);
      const comentarios = toNonNegativeInt(op.comentarios);
      const indicacoes = toNonNegativeInt(op.indicacoes);
      const direct = toNonNegativeInt(op.direct);
      const consultas = toNonNegativeInt(op.consultasAgendadas);

      totalLeadsAll += totalLeads;
      totalFollowupsAll += pontosContato;
      totalConsultasAll += consultas;

      // Eyebrow & Name
      ctx.fillStyle = '#CEFF29';
      ctx.font = `600 12px ${FONT_SANS}`;
      ctx.fillText('OPERAÇÃO', ox, oy + 14);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 29px ${FONT_DISPLAY}`;
      ctx.fillText(opNameUpper.slice(0, 32), ox, oy + 50);

      // Pill right
      const pillW = 136;
      const pillX = ox + contentW - pillW;
      drawRoundedRect(ctx, pillX, oy + 10, pillW, 34, 17, '#0E1116', '#22262E', 1);
      ctx.fillStyle = '#8A919E';
      ctx.font = `600 12px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText(`OPERAÇÃO ${String(idx + 1).padStart(2, '0')}`, pillX + pillW / 2, oy + 31);
      ctx.textAlign = 'left';

      // Divider
      ctx.strokeStyle = '#22262E';
      ctx.beginPath();
      ctx.moveTo(ox, oy + 68);
      ctx.lineTo(ox + contentW, oy + 68);
      ctx.stroke();

      oy += 98;

      // INDICADORES DO DIA
      ctx.fillStyle = '#8A919E';
      ctx.font = `600 12px ${FONT_SANS}`;
      ctx.fillText('INDICADORES DO DIA', ox, oy + 14);
      oy += 30;

      const kpiW = (contentW - 18) / 2;
      const kpiH = 140;
      drawRoundedRect(ctx, ox, oy, kpiW, kpiH, 18, '#0E1116', '#20242C', 1);
      drawRoundedRect(ctx, ox + kpiW + 18, oy, kpiW, kpiH, 18, '#0E1116', '#20242C', 1);

      ctx.fillStyle = '#8A919E';
      ctx.font = `600 12px ${FONT_SANS}`;
      ctx.fillText('TOTAL DE LEADS', ox + 28, oy + 36);
      ctx.fillText('PONTOS DE CONTATO', ox + kpiW + 46, oy + 36);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 46px ${FONT_DISPLAY}`;
      ctx.fillText(String(totalLeads), ox + 28, oy + 90);
      ctx.fillText(String(pontosContato), ox + kpiW + 46, oy + 90);

      ctx.fillStyle = '#68707D';
      ctx.font = `400 14px ${FONT_SANS}`;
      ctx.fillText(`${formatLeadsRecebidosPlural(totalLeads)} no dia`, ox + 28, oy + 118);
      ctx.fillText('Follow-ups e interações ativas', ox + kpiW + 46, oy + 118);

      oy += kpiH + 30;

      // EVOLUÇÃO DO FUNIL
      ctx.fillStyle = '#8A919E';
      ctx.font = `600 12px ${FONT_SANS}`;
      ctx.fillText('EVOLUÇÃO DO FUNIL', ox, oy + 14);
      oy += 30;

      const consultasInfo = formatConsultasFunnel(consultas);
      const colW = (contentW - 14) / 2;
      const rowH = 82;

      const drawFunnelCell = (x, y, w, title, note, valText, accentType) => {
        const bg = accentType === 'green' ? '#101B12' : '#0E1116';
        const bd = accentType === 'green' ? '#264A23' : '#20242C';
        drawRoundedRect(ctx, x, y, w, rowH, 16, bg, bd, 1);

        // Icon box
        const ibg =
          accentType === 'yellow'
            ? 'rgba(245, 196, 81, 0.12)'
            : accentType === 'green'
            ? '#162816'
            : '#161A22';
        const ibd =
          accentType === 'yellow'
            ? 'rgba(245, 196, 81, 0.35)'
            : accentType === 'green'
            ? '#2B5027'
            : '#242933';
        drawRoundedRect(ctx, x + 20, y + 22, 38, 38, 10, ibg, ibd, 1);

        // Dot / symbol inside icon box
        ctx.fillStyle =
          accentType === 'yellow' ? '#F5C451' : accentType === 'green' ? '#CEFF29' : '#9BA3B0';
        ctx.beginPath();
        ctx.arc(x + 39, y + 41, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Title & optional note
        ctx.fillStyle = '#F5F7FA';
        ctx.font = `600 16px ${FONT_SANS}`;
        if (note) {
          ctx.fillText(title, x + 72, y + 36);
          ctx.fillStyle = '#F5C451';
          ctx.font = `400 14px ${FONT_SANS}`;
          ctx.fillText(note.slice(0, 62), x + 72, y + 58);
        } else {
          ctx.fillText(title, x + 72, y + 47);
        }

        // Value right
        ctx.textAlign = 'right';
        ctx.fillStyle =
          accentType === 'green' && !consultasInfo.isZero
            ? '#CEFF29'
            : accentType === 'green' && consultasInfo.isZero
            ? '#8A919E'
            : '#FFFFFF';
        ctx.font = `600 21px ${FONT_DISPLAY}`;
        ctx.fillText(valText, x + w - 24, y + 48);
        ctx.textAlign = 'left';
      };

      if (leadFrioObs) {
        drawFunnelCell(ox, oy, contentW, 'Lead frio', leadFrioObs, formatLeadsPlural(leadFrio), 'yellow');
        oy += rowH + 14;

        drawFunnelCell(ox, oy, colW, 'Qualificação', '', formatLeadsPlural(qualificacao), 'neutral');
        drawFunnelCell(ox + colW + 14, oy, colW, 'Comentários', '', formatLeadsPlural(comentarios), 'neutral');
        oy += rowH + 14;

        drawFunnelCell(ox, oy, colW, 'Indicações', '', formatLeadsPlural(indicacoes), 'neutral');
        drawFunnelCell(ox + colW + 14, oy, colW, 'Direct', '', formatLeadsPlural(direct), 'neutral');
        oy += rowH + 14;

        drawFunnelCell(ox, oy, contentW, consultasInfo.label, '', consultasInfo.value, 'green');
        oy += rowH + 30;
      } else {
        drawFunnelCell(ox, oy, colW, 'Lead frio', '', formatLeadsPlural(leadFrio), 'yellow');
        drawFunnelCell(ox + colW + 14, oy, colW, 'Qualificação', '', formatLeadsPlural(qualificacao), 'neutral');
        oy += rowH + 14;

        drawFunnelCell(ox, oy, colW, 'Comentários', '', formatLeadsPlural(comentarios), 'neutral');
        drawFunnelCell(ox + colW + 14, oy, colW, 'Indicações', '', formatLeadsPlural(indicacoes), 'neutral');
        oy += rowH + 14;

        drawFunnelCell(ox, oy, colW, 'Direct', '', formatLeadsPlural(direct), 'neutral');
        drawFunnelCell(ox + colW + 14, oy, colW, consultasInfo.label, '', consultasInfo.value, 'green');
        oy += rowH + 30;
      }

      // TAXA DE CONVERSÃO DIÁRIA
      const convH = 106;
      drawRoundedRect(ctx, ox, oy, contentW, convH, 18, '#111F13', '#284D24', 1);

      ctx.fillStyle = '#CEFF29';
      ctx.font = `600 12px ${FONT_SANS}`;
      ctx.fillText('TAXA DE CONVERSÃO DIÁRIA', ox + 30, oy + 38);

      ctx.fillStyle = '#ADC0AD';
      ctx.font = `500 15px ${FONT_SANS}`;
      ctx.fillText(
        `${formatConsultasPluralLine(consultas)}   •   ${formatLeadsRecebidosPlural(totalLeads)}`,
        ox + 30,
        oy + 68
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = '#CEFF29';
      ctx.font = `700 44px ${FONT_DISPLAY}`;
      ctx.fillText(calcConversionRate(consultas, totalLeads), ox + contentW - 30, oy + 68);
      ctx.textAlign = 'left';

      curY += opH + 36;
    });

    // 3. RESUMO DO DIA
    drawRoundedRect(ctx, PAD, curY, innerW, summaryH, 24, '#13161B', '#232730', 1);
    const sx = PAD + 44;
    const sy = curY + 36;
    const sContentW = innerW - 88;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 19px ${FONT_DISPLAY}`;
    ctx.fillText('RESUMO DO DIA', sx, sy + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#8A919E';
    ctx.font = `500 14px ${FONT_SANS}`;
    ctx.fillText(
      `Consolidado de ${state.operations.length === 1 ? '1 operação' : `${state.operations.length} operações`}`,
      sx + sContentW,
      sy + 20
    );
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#22262E';
    ctx.beginPath();
    ctx.moveTo(sx, sy + 38);
    ctx.lineTo(sx + sContentW, sy + 38);
    ctx.stroke();

    const sBoxW = (sContentW - 48) / 4;
    const sBoxH = 104;
    const sBoxY = sy + 58;

    const summaryItems = [
      { label: 'LEADS', val: String(totalLeadsAll), green: false },
      { label: 'FOLLOW-UPS', val: String(totalFollowupsAll), green: false },
      { label: 'CONSULTAS', val: String(totalConsultasAll), green: false },
      { label: 'CONVERSÃO', val: calcConversionRate(totalConsultasAll, totalLeadsAll), green: true }
    ];

    summaryItems.forEach((item, i) => {
      const bx = sx + i * (sBoxW + 16);
      drawRoundedRect(
        ctx,
        bx,
        sBoxY,
        sBoxW,
        sBoxH,
        16,
        item.green ? '#111F13' : '#0E1116',
        item.green ? '#284D24' : '#20242C',
        1
      );
      ctx.fillStyle = item.green ? '#CEFF29' : '#8A919E';
      ctx.font = `600 11.5px ${FONT_SANS}`;
      ctx.fillText(item.label, bx + 20, sBoxY + 34);

      ctx.fillStyle = item.green ? '#CEFF29' : '#FFFFFF';
      ctx.font = `700 34px ${FONT_DISPLAY}`;
      ctx.fillText(item.val, bx + 20, sBoxY + 78);
    });

    curY += summaryH + 36;

    // 4. FOOTER
    ctx.fillStyle = '#CEFF29';
    ctx.beginPath();
    ctx.arc(PAD + 12, curY + 14, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F5F7FA';
    ctx.font = `600 14px ${FONT_SANS}`;
    ctx.fillText('Fazendo Acontecer', PAD + 24, curY + 19);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#8A919E';
    ctx.font = `500 14px ${FONT_SANS}`;
    ctx.fillText('Performance Comercial', PAD + innerW - 8, curY + 19);
    ctx.textAlign = 'left';

    return canvas;
  }

  /**
   * Gera um HTMLCanvasElement em alta resolução (pixelRatio: 2, 1080px base)
   * Tenta htmlToImage primeiro num clone offscreen sem transform; se houver bloqueio de ambiente (ex: file://),
   * utiliza imediatamente o renderizador Canvas 2D nativo de alta precisão.
   */
  async function generateHighResCanvas() {
    if (window.htmlToImage && typeof window.htmlToImage.toCanvas === 'function' && window.location.protocol !== 'file:') {
      const offscreenWrapper = document.createElement('div');
      offscreenWrapper.style.position = 'fixed';
      offscreenWrapper.style.left = '-99999px';
      offscreenWrapper.style.top = '0';
      offscreenWrapper.style.width = '1080px';
      offscreenWrapper.style.zIndex = '-1';
      offscreenWrapper.style.pointerEvents = 'none';

      const clone = dom.reportCaptureTarget.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.width = '1080px';
      offscreenWrapper.appendChild(clone);
      document.body.appendChild(offscreenWrapper);

      try {
        const canvas = await window.htmlToImage.toCanvas(clone, {
          width: 1080,
          pixelRatio: 2,
          backgroundColor: '#0B0D10',
          cacheBust: false
        });
        document.body.removeChild(offscreenWrapper);
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          return canvas;
        }
      } catch (err) {
        try {
          const canvasFallback = await window.htmlToImage.toCanvas(clone, {
            width: 1080,
            pixelRatio: 2,
            backgroundColor: '#0B0D10',
            skipFonts: true
          });
          document.body.removeChild(offscreenWrapper);
          if (canvasFallback && canvasFallback.width > 0 && canvasFallback.height > 0) {
            return canvasFallback;
          }
        } catch (_) {
          if (offscreenWrapper.parentNode) {
            document.body.removeChild(offscreenWrapper);
          }
        }
      }
    }

    return renderReportViaNativeCanvas2D();
  }

  function canvasToBlob(canvas, type = 'image/png', quality = 0.96) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha ao converter imagem.'));
        },
        type,
        quality
      );
    });
  }

  // =========================================================================
  // AÇÕES DE COMPARTILHAMENTO: COPIAR IMAGEM & BAIXAR JPG
  // =========================================================================

  function showClipboardFeedback(message, type = 'success') {
    dom.clipboardAlert.hidden = false;
    dom.clipboardAlert.className = `clipboard-feedback ${type === 'success' ? 'is-success' : 'is-warning'}`;
    dom.clipboardAlert.textContent = message;
  }

  async function handleCopyImage() {
    if (
      !navigator.clipboard ||
      typeof navigator.clipboard.write !== 'function' ||
      typeof window.ClipboardItem === 'undefined'
    ) {
      showClipboardFeedback(
        'Seu navegador não permite copiar a imagem diretamente. Utilize Baixar JPG.',
        'warning'
      );
      return;
    }

    const originalLabel = dom.copyBtnLabel.textContent;
    dom.copyBtnLabel.textContent = 'COPIANDO IMAGEM...';
    dom.btnCopyImage.disabled = true;

    try {
      const pngBlobPromise = (async () => {
        const canvas = await (cachedCanvasPromise || generateHighResCanvas());
        return await canvasToBlob(canvas, 'image/png');
      })();

      const item = new window.ClipboardItem({
        'image/png': pngBlobPromise
      });

      await navigator.clipboard.write([item]);

      dom.copyBtnLabel.textContent = '✓ IMAGEM COPIADA!';
      showClipboardFeedback('✓ Imagem copiada! Agora basta abrir o WhatsApp e pressionar CTRL + V.', 'success');

      setTimeout(() => {
        dom.copyBtnLabel.textContent = originalLabel;
      }, 2800);
    } catch (err) {
      // Fallback caso o navegador exija Blob já resolvido antes de instanciar ClipboardItem
      try {
        const canvas = renderReportViaNativeCanvas2D();
        const blob = await canvasToBlob(canvas, 'image/png');
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);

        dom.copyBtnLabel.textContent = '✓ IMAGEM COPIADA!';
        showClipboardFeedback('✓ Imagem copiada! Agora basta abrir o WhatsApp e pressionar CTRL + V.', 'success');
        setTimeout(() => {
          dom.copyBtnLabel.textContent = originalLabel;
        }, 2800);
      } catch (fallbackErr) {
        dom.copyBtnLabel.textContent = originalLabel;
        showClipboardFeedback(
          'Seu navegador não permite copiar a imagem diretamente. Utilize Baixar JPG.',
          'warning'
        );
      }
    } finally {
      dom.btnCopyImage.disabled = false;
    }
  }

  async function handleDownloadJpg() {
    const originalLabel = dom.downloadBtnLabel.textContent;
    dom.downloadBtnLabel.textContent = 'GERANDO JPG...';
    dom.btnDownloadJpg.disabled = true;

    try {
      const canvas = await (cachedCanvasPromise || generateHighResCanvas());
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.96);
      const filename = buildReportFilename(state.sdrName, state.reportDate);

      const link = document.createElement('a');
      link.download = filename;
      link.href = jpgDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      dom.downloadBtnLabel.textContent = '✓ JPG BAIXADO!';
      setTimeout(() => {
        dom.downloadBtnLabel.textContent = originalLabel;
      }, 2500);
    } catch (err) {
      const canvas = renderReportViaNativeCanvas2D();
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.96);
      const filename = buildReportFilename(state.sdrName, state.reportDate);

      const link = document.createElement('a');
      link.download = filename;
      link.href = jpgDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      dom.downloadBtnLabel.textContent = originalLabel;
    } finally {
      dom.btnDownloadJpg.disabled = false;
    }
  }

  // =========================================================================
  // NAVEGAÇÃO ENTRE FORMULÁRIO E VISUALIZAÇÃO
  // =========================================================================

  function openReportPreview() {
    if (!validateForm()) return;

    renderReportGraphicDOM();
    dom.clipboardAlert.hidden = true;

    dom.viewForm.hidden = true;
    dom.viewPreview.hidden = false;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    requestAnimationFrame(() => {
      updatePreviewScale();
      cachedCanvasPromise = generateHighResCanvas();
    });
  }

  function backToEditForm() {
    dom.viewPreview.hidden = true;
    dom.viewForm.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hasAnyDataFilled() {
    if (state.sdrName.trim() !== '') return true;
    if (state.operations.length > 1) return true;
    const op = state.operations[0];
    if (!op) return false;
    return Boolean(
      op.name.trim() ||
        op.totalLeads !== '' ||
        op.pontosContato !== '' ||
        op.leadFrio !== '' ||
        op.leadFrioObs.trim() ||
        op.qualificacao !== '' ||
        op.comentarios !== '' ||
        op.indicacoes !== '' ||
        op.direct !== '' ||
        op.consultasAgendadas !== ''
    );
  }

  function resetAllData() {
    state.sdrName = '';
    state.reportDate = getTodayISO();
    state.operations = [createEmptyOperation()];
    cachedCanvasPromise = null;

    dom.sdrNameInput.value = '';
    dom.sdrNameInput.classList.remove('input-error');
    dom.errorSdrName.hidden = true;

    dom.reportDateInput.value = state.reportDate;
    updateDatePreviewUI();
    renderOperationsList();
    updateSummaryUI();

    dom.confirmModal.hidden = true;
    dom.viewPreview.hidden = true;
    dom.viewForm.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fillExampleTestData() {
    state.sdrName = 'Beatriz';
    state.reportDate = '2026-07-27';
    state.operations = [
      createEmptyOperation({
        name: 'FERNANDO SILVEIRA',
        totalLeads: '4',
        pontosContato: '129',
        leadFrio: '1',
        leadFrioObs: 'chegou às 22h42 do dia 27/07',
        qualificacao: '0',
        comentarios: '1',
        indicacoes: '2',
        direct: '0',
        consultasAgendadas: '0'
      }),
      createEmptyOperation({
        name: 'DOCTORS',
        totalLeads: '0',
        pontosContato: '7',
        leadFrio: '0',
        leadFrioObs: '',
        qualificacao: '0',
        comentarios: '0',
        indicacoes: '0',
        direct: '0',
        consultasAgendadas: '0'
      })
    ];

    dom.sdrNameInput.value = state.sdrName;
    dom.sdrNameInput.classList.remove('input-error');
    dom.errorSdrName.hidden = true;

    dom.reportDateInput.value = state.reportDate;
    updateDatePreviewUI();
    renderOperationsList();
    updateSummaryUI();
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================

  function bindEvents() {
    // Nome da SDR
    dom.sdrNameInput.addEventListener('input', (e) => {
      state.sdrName = e.target.value;
      if (state.sdrName.trim()) {
        dom.sdrNameInput.classList.remove('input-error');
        dom.errorSdrName.hidden = true;
      }
    });

    // Data do relatório
    dom.reportDateInput.addEventListener('change', (e) => {
      state.reportDate = e.target.value || getTodayISO();
      updateDatePreviewUI();
    });

    dom.btnSetToday.addEventListener('click', () => {
      state.reportDate = getTodayISO();
      dom.reportDateInput.value = state.reportDate;
      updateDatePreviewUI();
    });

    // Preencher dados de exemplo
    dom.btnFillExample.addEventListener('click', fillExampleTestData);

    // Eventos delegados dentro da lista de operações
    dom.operationsContainer.addEventListener('input', (e) => {
      const target = e.target;
      const opId = target.getAttribute('data-op-id');
      const field = target.getAttribute('data-field');
      if (!opId || !field) return;

      const op = state.operations.find((item) => item.id === opId);
      if (!op) return;

      if (target.getAttribute('data-numeric') === 'true') {
        const sanitized = sanitizeNumericString(target.value);
        if (target.value !== sanitized) {
          target.value = sanitized;
        }
        op[field] = sanitized;
      } else {
        op[field] = target.value;
        if (field === 'name' && target.value.trim()) {
          target.classList.remove('input-error');
          const errEl = dom.operationsContainer.querySelector(`[data-error-for="op-name-${opId}"]`);
          if (errEl) errEl.hidden = true;
        }
      }

      updateOperationCalculatedUI(opId);
      updateSummaryUI();
    });

    // Duplicar ou Excluir operação
    dom.operationsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const opId = btn.getAttribute('data-op-id');
      const index = state.operations.findIndex((item) => item.id === opId);
      if (index === -1) return;

      if (action === 'duplicate-op') {
        const source = state.operations[index];
        const duplicated = createEmptyOperation({
          name: source.name ? `${source.name} (CÓPIA)` : '',
          totalLeads: source.totalLeads,
          pontosContato: source.pontosContato,
          leadFrio: source.leadFrio,
          leadFrioObs: source.leadFrioObs,
          qualificacao: source.qualificacao,
          comentarios: source.comentarios,
          indicacoes: source.indicacoes,
          direct: source.direct,
          consultasAgendadas: source.consultasAgendadas
        });
        state.operations.splice(index + 1, 0, duplicated);
        renderOperationsList();
        updateSummaryUI();
      } else if (action === 'delete-op') {
        if (state.operations.length <= 1) return;
        state.operations.splice(index, 1);
        renderOperationsList();
        updateSummaryUI();
      }
    });

    // Adicionar nova operação
    dom.btnAddOperation.addEventListener('click', () => {
      const newOp = createEmptyOperation();
      state.operations.push(newOp);
      renderOperationsList();
      updateSummaryUI();

      const newInput = document.getElementById(`op-name-${newOp.id}`);
      if (newInput) {
        newInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        newInput.focus();
      }
    });

    // Submit do formulário -> Gerar Relatório
    dom.form.addEventListener('submit', (e) => {
      e.preventDefault();
      openReportPreview();
    });

    // Botões da tela de resultado
    dom.btnBackEdit.addEventListener('click', backToEditForm);

    dom.btnCopyImage.addEventListener('click', handleCopyImage);

    dom.btnDownloadJpg.addEventListener('click', handleDownloadJpg);

    dom.btnNewReport.addEventListener('click', () => {
      if (hasAnyDataFilled()) {
        dom.confirmModal.hidden = false;
      } else {
        resetAllData();
      }
    });

    dom.btnModalCancel.addEventListener('click', () => {
      dom.confirmModal.hidden = true;
    });

    dom.btnModalConfirm.addEventListener('click', resetAllData);

    dom.confirmModal.addEventListener('click', (e) => {
      if (e.target === dom.confirmModal) {
        dom.confirmModal.hidden = true;
      }
    });

    window.addEventListener('resize', updatePreviewScale);
  }

  // =========================================================================
  // INICIALIZAÇÃO
  // =========================================================================

  function init() {
    dom.headerCurrentDate.textContent = formatHeaderTodayDate();
    dom.reportDateInput.value = state.reportDate;
    updateDatePreviewUI();
    renderOperationsList();
    updateSummaryUI();
    bindEvents();
  }

  init();
})();
