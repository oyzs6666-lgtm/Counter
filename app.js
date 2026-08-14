const STORAGE_KEY = 'bite-rhythm.app.v1';

const DEFAULT_TEMPLATES = [
  {
    id: 'meal-default', name: '正餐', allowAppend: true, appendBites: 3, appendWaitSeconds: 300,
    stages: [
      { id: 'm1', bites: 5, waitSeconds: 300 },
      { id: 'm2', bites: 3, waitSeconds: 300 },
      { id: 'm3', bites: 3, waitSeconds: 600 }
    ]
  },
  {
    id: 'snack-default', name: '零食', allowAppend: false, appendBites: 3, appendWaitSeconds: 300,
    stages: [{ id: 's1', bites: 4, waitSeconds: 180 }, { id: 's2', bites: 3, waitSeconds: 300 }]
  }
];

let state = loadState();
let currentView = 'today';
let historyDate = dateKey(new Date());
let historyMetric = 'calories';
let editingTemplateId = null;
let templateDraft = null;
let editingRecordId = null;
let countdownTimer = null;
let toastTimer = null;
let selectedSessionId = state.activeSessions[0]?.id || null;
let addingSession = false;

const el = {
  pageEyebrow: document.querySelector('#page-eyebrow'), pageTitle: document.querySelector('#page-title'), headerDate: document.querySelector('#header-date'),
  views: [...document.querySelectorAll('.view')], navButtons: [...document.querySelectorAll('.nav-button')],
  todayTotalCalories: document.querySelector('#today-total-calories'), todayMealCount: document.querySelector('#today-meal-count'), todayBiteCount: document.querySelector('#today-bite-count'), todayRecordCount: document.querySelector('#today-record-count'), todayRecords: document.querySelector('#today-records'),
  templatePickerPanel: document.querySelector('#template-picker-panel'), templatePickerLead: document.querySelector('#template-picker-lead'), cancelAddSession: document.querySelector('#cancel-add-session'), startTemplateList: document.querySelector('#start-template-list'), sessionPanel: document.querySelector('#session-panel'), sessionTabs: document.querySelector('#session-tabs'), addSession: document.querySelector('#add-session'), sessionTemplateName: document.querySelector('#session-template-name'), sessionStageLabel: document.querySelector('#session-stage-label'), sessionTotalBites: document.querySelector('#session-total-bites'), counterZone: document.querySelector('#counter-zone'), counterStatus: document.querySelector('#counter-status'), currentBites: document.querySelector('#current-bites'), stageBiteLimit: document.querySelector('#stage-bite-limit'), biteButton: document.querySelector('#bite-button'), waitingZone: document.querySelector('#waiting-zone'), waitingLabel: document.querySelector('#waiting-label'), countdown: document.querySelector('#countdown'), nextStageButton: document.querySelector('#next-stage-button'), undoBite: document.querySelector('#undo-bite'), editBites: document.querySelector('#edit-bites'), pauseSession: document.querySelector('#pause-session'), skipWait: document.querySelector('#skip-wait'), sessionBack: document.querySelector('#session-back'), sessionEnd: document.querySelector('#session-end'),
  templateManageList: document.querySelector('#template-manage-list'), newTemplate: document.querySelector('#new-template'), templateDialog: document.querySelector('#template-dialog'), templateForm: document.querySelector('#template-form'), templateDialogTitle: document.querySelector('#template-dialog-title'), templateName: document.querySelector('#template-name'), stageEditorList: document.querySelector('#stage-editor-list'), addStage: document.querySelector('#add-stage'), allowAppend: document.querySelector('#allow-append'), appendSettings: document.querySelector('#append-settings'), appendBites: document.querySelector('#append-bites'), appendWait: document.querySelector('#append-wait'),
  finishDialog: document.querySelector('#finish-dialog'), finishForm: document.querySelector('#finish-form'), finishAutoSummary: document.querySelector('#finish-auto-summary'), finishFood: document.querySelector('#finish-food'), finishCalories: document.querySelector('#finish-calories'), finishNotes: document.querySelector('#finish-notes'),
  bitesDialog: document.querySelector('#bites-dialog'), bitesForm: document.querySelector('#bites-form'), bitesInputLabel: document.querySelector('#bites-input-label'), bitesInput: document.querySelector('#bites-input'),
  recordDialog: document.querySelector('#record-dialog'), recordForm: document.querySelector('#record-form'), recordFood: document.querySelector('#record-food'), recordBites: document.querySelector('#record-bites'), recordCalories: document.querySelector('#record-calories'), recordStart: document.querySelector('#record-start'), recordEnd: document.querySelector('#record-end'), recordNotes: document.querySelector('#record-notes'),
  historyDate: document.querySelector('#history-date'), historyPrev: document.querySelector('#history-prev'), historyNext: document.querySelector('#history-next'), historyCalories: document.querySelector('#history-calories'), historyCount: document.querySelector('#history-count'), historyBites: document.querySelector('#history-bites'), historyRecordCount: document.querySelector('#history-record-count'), historyRecords: document.querySelector('#history-records'), metricTabs: document.querySelector('#metric-tabs'), trendChart: document.querySelector('#trend-chart'),
  toast: document.querySelector('#toast')
};

function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
function uid(prefix = 'id') { return crypto.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && Array.isArray(parsed.templates) && Array.isArray(parsed.records)) {
      const activeSessions = Array.isArray(parsed.activeSessions) ? parsed.activeSessions : parsed.activeSession ? [parsed.activeSession] : [];
      return { templates: parsed.templates, records: parsed.records, activeSessions };
    }
  } catch {}
  return { templates: deepCopy(DEFAULT_TEMPLATES), records: [], activeSessions: [] };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ templates:state.templates, records:state.records, activeSessions:state.activeSessions })); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]); }
function dateKey(value) { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dateFromKey(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); }
function formatDate(key, options = {}) { return new Intl.DateTimeFormat('zh-CN', { month:'long', day:'numeric', weekday:'short', ...options }).format(dateFromKey(key)); }
function formatTime(value) { return new Intl.DateTimeFormat('zh-CN', { hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value)); }
function toTimeInput(value) { const d = new Date(value); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function recordsForDate(key) { return state.records.filter(r => dateKey(r.startAt) === key).sort((a,b) => new Date(a.startAt)-new Date(b.startAt)); }
function totalsForDate(key) { const records = recordsForDate(key); return { records, calories: records.reduce((s,r)=>s+(Number(r.calories)||0),0), bites: records.reduce((s,r)=>s+(Number(r.totalBites)||0),0), count: records.length }; }
function showToast(message) { clearTimeout(toastTimer); el.toast.textContent = message; el.toast.classList.add('is-visible'); toastTimer = setTimeout(()=>el.toast.classList.remove('is-visible'),1900); }

function showView(name) {
  currentView = ['today','start','templates','history'].includes(name) ? name : 'today';
  const meta = {
    today: ['TODAY','今日饮食'], start: ['START','开始进食'], templates: ['COUNTERS','计数器'], history: ['HISTORY','历史统计']
  }[currentView];
  el.pageEyebrow.textContent = meta[0]; el.pageTitle.textContent = meta[1];
  el.views.forEach(view => { view.hidden = view.dataset.view !== currentView; view.classList.toggle('is-active', !view.hidden); });
  el.navButtons.forEach(button => { const active = button.dataset.target === currentView; button.classList.toggle('is-active', active); active ? button.setAttribute('aria-current','page') : button.removeAttribute('aria-current'); });
  if (currentView === 'today') renderToday();
  if (currentView === 'start') renderStart();
  if (currentView === 'templates') renderTemplates();
  if (currentView === 'history') renderHistory();
  window.scrollTo(0,0);
}

function renderRecordRows(records) {
  if (!records.length) return '<div class="empty-state">这一天还没有饮食记录。<br>从“开始”页面选择一个计数器吧。</div>';
  return records.map(record => `<article class="record-row">
    <button class="record-main-button" type="button" data-edit-record="${record.id}">
      <time class="record-time-badge" datetime="${record.startAt}">${formatTime(record.startAt)}</time>
      <span class="record-copy"><strong>${escapeHtml(record.food || record.templateName || '未命名食物')}</strong><span>${record.totalBites || 0}口 · ${escapeHtml(record.templateName || '已删除计数器')} · ${formatTime(record.startAt)}–${formatTime(record.endAt)}</span></span>
      <span class="record-kcal">${Number(record.calories)||0} kcal</span>
    </button>
    <button class="delete-record" type="button" data-delete-record="${record.id}" aria-label="删除记录">×</button>
  </article>`).join('');
}
function renderToday() {
  const today = dateKey(new Date()); const totals = totalsForDate(today);
  el.todayTotalCalories.textContent = totals.calories.toLocaleString('zh-CN'); el.todayMealCount.textContent = totals.count; el.todayBiteCount.textContent = totals.bites; el.todayRecordCount.textContent = `${totals.count} 条`; el.todayRecords.innerHTML = renderRecordRows(totals.records.slice().reverse());
}

function templateSummary(template) {
  return template.stages.map((stage,i)=>`第${i+1}阶段 ${stage.bites}口／${formatWait(stage.waitSeconds)}`).join(' · ');
}
function formatWait(seconds) { if (!seconds) return '不等待'; const minutes = seconds / 60; return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)}分钟`; }
function currentSession() {
  if (!state.activeSessions.length) { selectedSessionId=null; return null; }
  let session=state.activeSessions.find(item=>item.id===selectedSessionId);
  if (!session) { session=state.activeSessions[0]; selectedSessionId=session.id; }
  return session;
}
function renderStart() {
  const sessions=state.activeSessions, session=currentSession(), showPicker=!sessions.length||addingSession;
  el.templatePickerPanel.hidden=!showPicker; el.sessionPanel.hidden=!session;
  el.templatePickerLead.textContent=sessions.length?'再添加一个同时进行的计数器。':'选一个计数器，开始这次进食。';
  el.cancelAddSession.hidden=!sessions.length;
  if (showPicker) {
    el.startTemplateList.innerHTML=state.templates.length?state.templates.map(template=>{
      const active=sessions.find(item=>item.templateId===template.id);
      return `<button class="template-start-card${active?' is-running':''}" type="button" ${active?`data-select-session="${active.id}"`:`data-start-template="${template.id}"`}><strong>${escapeHtml(template.name)}${active?' · 进行中':''}</strong><span>${active?`已累计 ${active.totalBites}口，点击切换`:`${template.stages.length}个阶段<br>${escapeHtml(templateSummary(template))}`}</span></button>`;
    }).join(''):'<div class="empty-state">还没有计数器。<br>请先到“计数器”页面新建一个。</div>';
  }
  if (session) { renderSessionTabs(); renderSession(); }
}

function startSession(templateId) {
  const template = state.templates.find(t=>t.id===templateId); if (!template || !template.stages.length) return;
  const existing=state.activeSessions.find(item=>item.templateId===templateId);
  if (existing) { selectedSessionId=existing.id; addingSession=false; renderStart(); return showToast('这个计数器已经在进行中'); }
  const session={ id: uid('session'), templateId: template.id, templateName: template.name, stages: deepCopy(template.stages), allowAppend: !!template.allowAppend, appendBites: Number(template.appendBites)||3, appendWaitSeconds: Number(template.appendWaitSeconds)||0, currentStageIndex:0, currentBites:0, totalBites:0, completedStages:0, status:'counting', paused:false, waitEndAt:null, waitRemainingMs:null, startedAt:new Date().toISOString() };
  state.activeSessions.push(session); selectedSessionId=session.id; addingSession=false;
  saveState(); renderStart(); startTicker();
}
function selectSession(id) { if (!state.activeSessions.some(item=>item.id===id)) return; selectedSessionId=id; addingSession=false; renderStart(); }
function renderSessionTabs() {
  el.sessionTabs.innerHTML=state.activeSessions.map(session=>`<button class="session-tab${session.id===selectedSessionId?' is-active':''}" type="button" data-session-id="${session.id}"><strong>${escapeHtml(session.templateName)}</strong><span>${session.status==='waiting'?'等待中':session.status==='ready'?'可继续':session.paused?'已暂停':`累计 ${session.totalBites}口`}</span></button>`).join('');
}
function currentStage(session=currentSession()) { return session?.stages[session.currentStageIndex] || null; }
function addBite() {
  const s=currentSession(), stage=currentStage(s); if (!s || !stage || s.paused || s.status!=='counting') return;
  if (s.currentBites >= stage.bites) return;
  s.currentBites += 1; s.totalBites += 1;
  navigator.vibrate?.(35);
  if (s.currentBites >= stage.bites) { s.completedStages = Math.max(s.completedStages,s.currentStageIndex+1); beginWait(stage.waitSeconds); }
  saveState(); renderStart();
}
function beginWait(seconds) {
  const s=currentSession(); if (!s) return;
  const ms=Math.max(0,Number(seconds)||0)*1000;
  if (!ms) { s.status='ready'; s.waitEndAt=null; s.waitRemainingMs=0; }
  else { s.status='waiting'; s.waitEndAt=Date.now()+ms; s.waitRemainingMs=ms; }
}
function remainingWaitMs(s=currentSession()) {
  if (!s || s.status!=='waiting') return 0;
  return s.paused ? Math.max(0,Number(s.waitRemainingMs)||0) : Math.max(0,(Number(s.waitEndAt)||0)-Date.now());
}
function updateCountdown() {
  let changed=false;
  state.activeSessions.forEach(session=>{
    if(session.status==='waiting'&&!session.paused&&remainingWaitMs(session)<=0){session.status='ready';session.waitEndAt=null;session.waitRemainingMs=0;changed=true;navigator.vibrate?.([120,80,120]);}
  });
  if(changed){saveState();if(currentView==='start')renderStart();return;}
  const selected=currentSession();
  if(selected?.status==='waiting'&&currentView==='start')el.countdown.textContent=formatCountdown(remainingWaitMs(selected));
}
function formatCountdown(ms) { const seconds=Math.max(0,Math.ceil(ms/1000)); return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
function startTicker() { clearInterval(countdownTimer); countdownTimer=setInterval(updateCountdown,250); updateCountdown(); }
function renderSession() {
  const s=currentSession(), stage=currentStage(s); if (!s || !stage) return;
  el.sessionTemplateName.textContent=s.templateName; el.sessionStageLabel.textContent=`第${s.currentStageIndex+1}阶段`; el.sessionTotalBites.textContent=s.totalBites; el.currentBites.textContent=s.currentBites; el.stageBiteLimit.textContent=stage.bites;
  const waiting=s.status==='waiting'||s.status==='ready'; el.counterZone.hidden=waiting; el.waitingZone.hidden=!waiting;
  el.biteButton.disabled=s.paused; el.counterStatus.textContent=s.paused?'已暂停':`最多${stage.bites}口`;
  el.pauseSession.textContent=s.paused?'继续':'暂停'; el.pauseSession.hidden=s.status==='ready'; el.skipWait.hidden=s.status!=='waiting'; el.undoBite.disabled=s.currentBites<=0; el.editBites.disabled=waiting && !s.paused;
  if (s.status==='waiting') { el.waitingLabel.textContent=s.paused?'倒计时已暂停':'休息一下'; el.countdown.textContent=formatCountdown(remainingWaitMs(s)); el.nextStageButton.hidden=true; }
  if (s.status==='ready') { el.waitingLabel.textContent='可以继续了'; el.countdown.textContent='00:00'; el.nextStageButton.hidden=false; const last=s.currentStageIndex>=s.stages.length-1; el.nextStageButton.textContent=!last?'进入下一阶段':s.allowAppend?'追加阶段':'结束并保存'; }
}
function togglePause() {
  const s=currentSession(); if (!s || s.status==='ready') return;
  if (!s.paused) {
    const remaining = s.status==='waiting' ? Math.max(0,(Number(s.waitEndAt)||0)-Date.now()) : 0;
    s.paused=true;
    if (s.status==='waiting') { s.waitRemainingMs=remaining; s.waitEndAt=null; }
  }
  else { s.paused=false; if (s.status==='waiting') s.waitEndAt=Date.now()+(Number(s.waitRemainingMs)||0); }
  saveState(); renderStart();
}
function undoBite() {
  const s=currentSession(); if (!s || s.currentBites<=0) return;
  s.currentBites-=1; s.totalBites=Math.max(0,s.totalBites-1); s.completedStages=Math.min(s.completedStages,s.currentStageIndex); s.status='counting'; s.paused=false; s.waitEndAt=null; s.waitRemainingMs=null; saveState(); renderStart();
}
function editCurrentBites() {
  const s=currentSession(), stage=currentStage(s); if (!s||!stage) return;
  el.bitesInputLabel.textContent=`当前阶段口数（0–${stage.bites}）`;
  el.bitesInput.max=String(stage.bites);
  el.bitesInput.value=String(s.currentBites);
  el.bitesDialog.showModal();
  requestAnimationFrame(()=>el.bitesInput.select());
}
function saveCurrentBites(event) {
  event.preventDefault();
  const s=currentSession(), stage=currentStage(s); if (!s||!stage) return el.bitesDialog.close();
  const value=Number(el.bitesInput.value); if (!Number.isInteger(value)||value<0||value>stage.bites) return showToast('请输入有效的整数口数');
  s.totalBites=Math.max(0,s.totalBites-s.currentBites+value); s.currentBites=value; s.status='counting'; s.paused=false; s.waitEndAt=null; s.waitRemainingMs=null;
  if (value>=stage.bites) { s.completedStages=Math.max(s.completedStages,s.currentStageIndex+1); beginWait(stage.waitSeconds); } else s.completedStages=Math.min(s.completedStages,s.currentStageIndex);
  saveState(); el.bitesDialog.close(); renderStart();
}
function skipWait() { const s=currentSession(); if (!s||s.status!=='waiting') return; s.status='ready'; s.paused=false; s.waitEndAt=null; s.waitRemainingMs=0; saveState(); renderStart(); }
function nextStage() {
  const s=currentSession(); if (!s||s.status!=='ready') return;
  if (s.currentStageIndex<s.stages.length-1) s.currentStageIndex+=1;
  else if (s.allowAppend) { s.stages.push({ id:uid('extra'), bites:s.appendBites, waitSeconds:s.appendWaitSeconds, appended:true }); s.currentStageIndex+=1; }
  else return openFinishDialog();
  s.currentBites=0; s.status='counting'; s.paused=false; s.waitEndAt=null; s.waitRemainingMs=null; saveState(); renderStart();
}
function discardSession() { const s=currentSession();if(!s||!confirm(`退出“${s.templateName}”后，这一项尚未保存的计数会丢失。确定退出吗？`))return;state.activeSessions=state.activeSessions.filter(item=>item.id!==s.id);selectedSessionId=state.activeSessions[0]?.id||null;addingSession=false;saveState();renderStart(); }
function openFinishDialog() {
  const s=currentSession(); if (!s) return;
  const end=new Date(); el.finishAutoSummary.innerHTML=`<div><span>计数器</span><strong>${escapeHtml(s.templateName)}</strong></div><div><span>总口数</span><strong>${s.totalBites}口</strong></div><div><span>完成阶段</span><strong>${s.completedStages}个</strong></div><div><span>时间</span><strong>${formatTime(s.startedAt)}–${formatTime(end)}</strong></div>`;
  el.finishFood.value=''; el.finishCalories.value=''; el.finishNotes.value=''; el.finishDialog.showModal();
}
function saveFinishedSession(event) {
  event.preventDefault(); const s=currentSession(); if (!s) return el.finishDialog.close();
  const record={ id:uid('record'), startAt:s.startedAt, endAt:new Date().toISOString(), templateId:s.templateId, templateName:s.templateName, totalBites:s.totalBites, completedStages:s.completedStages, food:el.finishFood.value.trim(), calories:Math.max(0,Number(el.finishCalories.value)||0), notes:el.finishNotes.value.trim() };
  state.records.push(record); state.activeSessions=state.activeSessions.filter(item=>item.id!==s.id);selectedSessionId=state.activeSessions[0]?.id||null;addingSession=false;saveState();el.finishDialog.close();showView(state.activeSessions.length?'start':'today');showToast(`${s.templateName}记录已保存`);
}

function renderTemplates() {
  el.templateManageList.innerHTML=state.templates.length?state.templates.map(template=>`<article class="template-manage-card"><header><h3>${escapeHtml(template.name)}</h3><span>${template.stages.length}阶段</span></header><p>${escapeHtml(templateSummary(template))}${template.allowAppend?' · 可继续追加':''}</p><div class="card-actions"><button type="button" data-edit-template="${template.id}">编辑</button><button type="button" data-copy-template="${template.id}">复制</button><button class="danger" type="button" data-delete-template="${template.id}">删除</button></div></article>`).join(''):'<div class="empty-state">还没有计数器，点击右上角＋创建。</div>';
}
function openTemplateDialog(templateId=null) {
  editingTemplateId=templateId; const original=state.templates.find(t=>t.id===templateId);
  templateDraft=original?deepCopy(original):{ id:uid('template'), name:'', stages:[{id:uid('stage'),bites:5,waitSeconds:300}], allowAppend:false, appendBites:3, appendWaitSeconds:300 };
  el.templateDialogTitle.textContent=original?'编辑计数器':'新建计数器'; el.templateName.value=templateDraft.name; el.allowAppend.checked=templateDraft.allowAppend; el.appendBites.value=templateDraft.appendBites; el.appendWait.value=templateDraft.appendWaitSeconds/60; renderStageEditor(); el.templateDialog.showModal();
}
function renderStageEditor() {
  el.appendSettings.hidden=!el.allowAppend.checked;
  el.stageEditorList.innerHTML=templateDraft.stages.map((stage,index)=>`<div class="stage-editor-row" data-stage-id="${stage.id}"><span class="stage-number">${index+1}</span><label class="mini-field">允许口数<input data-stage-field="bites" type="number" min="1" max="999" inputmode="numeric" value="${stage.bites}"></label><label class="mini-field">等待分钟<input data-stage-field="wait" type="number" min="0" max="999" step="0.1" inputmode="decimal" value="${stage.waitSeconds/60}"></label><div class="stage-controls"><button type="button" data-stage-action="up" aria-label="上移">↑</button><button type="button" data-stage-action="down" aria-label="下移">↓</button><button type="button" class="remove-stage" data-stage-action="remove" aria-label="删除">×</button></div></div>`).join('');
}
function saveTemplate(event) {
  event.preventDefault(); syncTemplateDraft();
  if (!templateDraft.name.trim()) return showToast('请填写模板名称'); if (!templateDraft.stages.length) return showToast('至少需要一个阶段');
  const invalid=templateDraft.stages.some(s=>!Number.isFinite(s.bites)||s.bites<1||!Number.isFinite(s.waitSeconds)||s.waitSeconds<0); if(invalid)return showToast('请检查阶段口数和等待时间');
  const index=state.templates.findIndex(t=>t.id===editingTemplateId); if(index>=0)state.templates[index]=templateDraft; else state.templates.push(templateDraft); saveState(); el.templateDialog.close(); renderTemplates(); showToast('计数器已保存');
}
function syncTemplateDraft() {
  templateDraft.name=el.templateName.value.trim(); templateDraft.allowAppend=el.allowAppend.checked; templateDraft.appendBites=Math.max(1,Number(el.appendBites.value)||3); templateDraft.appendWaitSeconds=Math.max(0,Number(el.appendWait.value)||0)*60;
  [...el.stageEditorList.querySelectorAll('[data-stage-id]')].forEach(row=>{ const stage=templateDraft.stages.find(s=>s.id===row.dataset.stageId); if(stage){ stage.bites=Number(row.querySelector('[data-stage-field="bites"]').value); stage.waitSeconds=Math.max(0,Number(row.querySelector('[data-stage-field="wait"]').value)||0)*60; }});
}
function stageAction(action,id) { syncTemplateDraft(); const index=templateDraft.stages.findIndex(s=>s.id===id); if(index<0)return; if(action==='remove'){ if(templateDraft.stages.length===1)return showToast('至少保留一个阶段'); templateDraft.stages.splice(index,1); } if(action==='up'&&index>0)[templateDraft.stages[index-1],templateDraft.stages[index]]=[templateDraft.stages[index],templateDraft.stages[index-1]]; if(action==='down'&&index<templateDraft.stages.length-1)[templateDraft.stages[index+1],templateDraft.stages[index]]=[templateDraft.stages[index],templateDraft.stages[index+1]]; renderStageEditor(); }
function copyTemplate(id) { const source=state.templates.find(t=>t.id===id); if(!source)return; const copy=deepCopy(source); copy.id=uid('template'); copy.name=`${copy.name} 副本`; copy.stages.forEach(s=>s.id=uid('stage')); state.templates.push(copy); saveState(); renderTemplates(); showToast('已复制计数器'); }
function deleteTemplate(id) { const t=state.templates.find(t=>t.id===id); if(!t||!confirm(`删除计数器“${t.name}”？已有饮食记录不会被删除。`))return; state.templates=state.templates.filter(t=>t.id!==id); saveState(); renderTemplates(); }

function renderHistory() {
  const today=dateKey(new Date()); if(historyDate>today)historyDate=today; el.historyDate.value=historyDate; el.historyDate.max=today; el.historyNext.disabled=historyDate>=today;
  const totals=totalsForDate(historyDate); el.historyCalories.textContent=totals.calories; el.historyCount.textContent=totals.count; el.historyBites.textContent=totals.bites; el.historyRecordCount.textContent=`${totals.count} 条`; el.historyRecords.innerHTML=renderRecordRows(totals.records.slice().reverse()); requestAnimationFrame(renderTrendChart);
}
function moveHistoryDay(offset) { const date=dateFromKey(historyDate); date.setDate(date.getDate()+offset); const next=dateKey(date); if(next>dateKey(new Date()))return; historyDate=next; renderHistory(); }
function renderTrendChart() {
  const canvas=el.trendChart, rect=canvas.getBoundingClientRect(); if(!rect.width||!rect.height)return; const dpr=Math.min(devicePixelRatio||1,2); canvas.width=Math.round(rect.width*dpr); canvas.height=Math.round(rect.height*dpr); const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
  const days=[]; const end=dateFromKey(historyDate); for(let i=6;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const key=dateKey(d),t=totalsForDate(key);days.push({key,label:`${d.getMonth()+1}/${d.getDate()}`,value:historyMetric==='calories'?t.calories:historyMetric==='count'?t.count:t.bites});}
  const plot={left:18,right:rect.width-8,top:14,bottom:rect.height-24}, max=Math.max(1,...days.map(d=>d.value));
  ctx.strokeStyle='#e5e1d8';ctx.lineWidth=1;for(let i=0;i<4;i++){const y=plot.top+(plot.bottom-plot.top)*i/3;ctx.beginPath();ctx.moveTo(plot.left,y);ctx.lineTo(plot.right,y);ctx.stroke();}
  const x=i=>plot.left+(plot.right-plot.left)*i/6, y=v=>plot.bottom-(plot.bottom-plot.top)*v/max;
  ctx.strokeStyle='#315f4b';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.beginPath();days.forEach((d,i)=>i?ctx.lineTo(x(i),y(d.value)):ctx.moveTo(x(i),y(d.value)));ctx.stroke();
  days.forEach((d,i)=>{ctx.fillStyle='#315f4b';ctx.beginPath();ctx.arc(x(i),y(d.value),3.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#747b75';ctx.font='9px system-ui';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(d.label,x(i),plot.bottom+7);if(d.value){ctx.textBaseline='bottom';ctx.fillText(String(d.value),x(i),y(d.value)-5);}});
}

function openRecordEditor(id) { const r=state.records.find(r=>r.id===id);if(!r)return;editingRecordId=id;el.recordFood.value=r.food||'';el.recordBites.value=r.totalBites||0;el.recordCalories.value=r.calories||0;el.recordStart.value=toTimeInput(r.startAt);el.recordEnd.value=toTimeInput(r.endAt);el.recordNotes.value=r.notes||'';el.recordDialog.showModal(); }
function saveEditedRecord(event) { event.preventDefault();const index=state.records.findIndex(r=>r.id===editingRecordId);if(index<0)return;const old=state.records[index],start=new Date(old.startAt),end=new Date(old.endAt);const [sh,sm]=el.recordStart.value.split(':').map(Number),[eh,em]=el.recordEnd.value.split(':').map(Number);start.setHours(sh,sm,0,0);end.setHours(eh,em,0,0);if(end<start)end.setDate(end.getDate()+1);state.records[index]={...old,food:el.recordFood.value.trim(),totalBites:Math.max(0,Number(el.recordBites.value)||0),calories:Math.max(0,Number(el.recordCalories.value)||0),startAt:start.toISOString(),endAt:end.toISOString(),notes:el.recordNotes.value.trim()};saveState();el.recordDialog.close();editingRecordId=null;renderToday();renderHistory();showToast('记录已更新'); }
function deleteRecord(id) { const r=state.records.find(r=>r.id===id);if(!r||!confirm(`删除 ${formatTime(r.startAt)} 的饮食记录？`))return;state.records=state.records.filter(r=>r.id!==id);saveState();renderToday();renderHistory();showToast('记录已删除'); }
function handleRecordListClick(event) { const del=event.target.closest('[data-delete-record]');if(del)return deleteRecord(del.dataset.deleteRecord);const edit=event.target.closest('[data-edit-record]');if(edit)openRecordEditor(edit.dataset.editRecord); }

el.navButtons.forEach(button=>button.addEventListener('click',()=>showView(button.dataset.target)));
el.startTemplateList.addEventListener('click',e=>{const start=e.target.closest('[data-start-template]'),select=e.target.closest('[data-select-session]');if(start)startSession(start.dataset.startTemplate);if(select)selectSession(select.dataset.selectSession);});
el.sessionTabs.addEventListener('click',e=>{const button=e.target.closest('[data-session-id]');if(button)selectSession(button.dataset.sessionId);});
el.addSession.addEventListener('click',()=>{addingSession=true;renderStart();window.scrollTo(0,0);});el.cancelAddSession.addEventListener('click',()=>{addingSession=false;renderStart();});
el.biteButton.addEventListener('click',addBite);el.undoBite.addEventListener('click',undoBite);el.editBites.addEventListener('click',editCurrentBites);el.pauseSession.addEventListener('click',togglePause);el.skipWait.addEventListener('click',skipWait);el.nextStageButton.addEventListener('click',nextStage);el.sessionBack.addEventListener('click',discardSession);el.sessionEnd.addEventListener('click',openFinishDialog);
el.bitesForm.addEventListener('submit',saveCurrentBites);document.querySelectorAll('[data-close-bites]').forEach(b=>b.addEventListener('click',()=>el.bitesDialog.close()));
el.finishForm.addEventListener('submit',saveFinishedSession);document.querySelectorAll('[data-cancel-finish]').forEach(b=>b.addEventListener('click',()=>el.finishDialog.close()));
el.newTemplate.addEventListener('click',()=>openTemplateDialog());el.templateManageList.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-template]'),copy=e.target.closest('[data-copy-template]'),del=e.target.closest('[data-delete-template]');if(edit)openTemplateDialog(edit.dataset.editTemplate);if(copy)copyTemplate(copy.dataset.copyTemplate);if(del)deleteTemplate(del.dataset.deleteTemplate);});
el.addStage.addEventListener('click',()=>{syncTemplateDraft();templateDraft.stages.push({id:uid('stage'),bites:3,waitSeconds:300});renderStageEditor();});el.stageEditorList.addEventListener('click',e=>{const button=e.target.closest('[data-stage-action]'),row=e.target.closest('[data-stage-id]');if(button&&row)stageAction(button.dataset.stageAction,row.dataset.stageId);});el.allowAppend.addEventListener('change',()=>{el.appendSettings.hidden=!el.allowAppend.checked;});el.templateForm.addEventListener('submit',saveTemplate);document.querySelectorAll('[data-close-template]').forEach(b=>b.addEventListener('click',()=>el.templateDialog.close()));
el.todayRecords.addEventListener('click',handleRecordListClick);el.historyRecords.addEventListener('click',handleRecordListClick);el.recordForm.addEventListener('submit',saveEditedRecord);document.querySelectorAll('[data-close-record]').forEach(b=>b.addEventListener('click',()=>el.recordDialog.close()));
el.historyPrev.addEventListener('click',()=>moveHistoryDay(-1));el.historyNext.addEventListener('click',()=>moveHistoryDay(1));el.historyDate.addEventListener('change',()=>{if(el.historyDate.value){historyDate=el.historyDate.value;renderHistory();}});el.metricTabs.addEventListener('click',e=>{const b=e.target.closest('[data-metric]');if(!b)return;historyMetric=b.dataset.metric;[...el.metricTabs.children].forEach(x=>x.classList.toggle('is-active',x===b));renderTrendChart();});
window.addEventListener('resize',()=>{if(currentView==='history')renderTrendChart();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateCountdown();renderToday();}});

el.headerDate.textContent=formatDate(dateKey(new Date()),{year:'numeric'});startTicker();showView('today');
