// script.js
const STORAGE_KEY = 'fittrack_data_v1';
const defaultState = { goals: [], activities: [] };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(defaultState);
  } catch(e) {
    return structuredClone(defaultState);
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// DOM refs
const goalsListEl = document.getElementById('goalsList');
const recentActivitiesEl = document.getElementById('recentActivities');
const activitiesTableBody = document.querySelector('#activitiesTable tbody');
const summaryCountEl = document.getElementById('summaryCount');
const progressArea = document.getElementById('progressArea');

// forms
const formGoal = document.getElementById('formGoal');
const formActivity = document.getElementById('formActivity');

// chart
const chartCtx = document.getElementById('chartActivities').getContext('2d');
let activitiesChart;

// helpers
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function fmtDate(d) { return new Date(d).toLocaleDateString(); }
function escapeHtml(str) { if(!str) return ''; return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

function computeGoalProgress(goal) {
  const total = state.activities.reduce((acc,a)=>{
    if(a.unit === goal.unit) {
      const keyword = goal.title.split(' ')[0].toLowerCase();
      if(a.type.toLowerCase().includes(keyword) || goal.title.toLowerCase().includes(a.type.toLowerCase())) return acc + Number(a.amount);
      return acc + Number(a.amount);
    }
    return acc;
  },0);
  const percent = goal.target>0 ? Math.round((total/goal.target)*100) : 0;
  return { total, percent };
}

function renderGoals() {
  goalsListEl.innerHTML = '';
  if(state.goals.length===0){
    goalsListEl.innerHTML = '<li class="list-group-item small-muted">Sem metas. Crie a primeira!</li>';
    return;
  }
  state.goals.forEach(g => {
    const done = computeGoalProgress(g).percent;
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex align-items-center justify-content-between';
    li.innerHTML = `<div>
      <div class="fw-semibold">${escapeHtml(g.title)}</div>
      <div class="small-muted">${g.progress || 0}/${g.target} ${escapeHtml(g.unit)} • ${done}%</div>
    </div>
    <div style="min-width:150px">
      <div class="progress progress-small mb-1">
        <div class="progress-bar" role="progressbar" style="width:${Math.min(done,100)}%" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <div class="d-flex gap-1 justify-content-end">
        <button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${g.id}">Editar</button>
        <button class="btn btn-sm btn-outline-danger btn-del" data-id="${g.id}">Remover</button>
      </div>
    </div>`;
    goalsListEl.appendChild(li);
  });
}

function renderRecentActivities() {
  recentActivitiesEl.innerHTML='';
  const last = [...state.activities].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  if(last.length===0){recentActivitiesEl.innerHTML='<li class="list-group-item small-muted">Nenhuma atividade registrada.</li>';return}
  last.forEach(a=>{
    const li=document.createElement('li'); li.className='list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `<div>
      <div class="fw-semibold">${escapeHtml(a.type)}</div>
      <div class="small-muted">${fmtDate(a.date)} • ${a.amount} ${escapeHtml(a.unit)}</div>
    </div>
    <div><button class="btn btn-sm btn-outline-danger btn-del-act" data-id="${a.id}">Apagar</button></div>`;
    recentActivitiesEl.appendChild(li);
  })
}

function renderActivitiesTable() {
  activitiesTableBody.innerHTML='';
  const rows = [...state.activities].sort((a,b)=>new Date(b.date)-new Date(a.date));
  rows.forEach(a=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${fmtDate(a.date)}</td><td>${escapeHtml(a.type)}</td><td>${a.amount}</td><td>${escapeHtml(a.unit)}</td><td><button class="btn btn-sm btn-outline-danger btn-del-act" data-id="${a.id}">Apagar</button></td>`;
    activitiesTableBody.appendChild(tr);
  })
}

function renderProgressArea() {
  progressArea.innerHTML='';
  if(state.goals.length===0) {progressArea.innerHTML='<div class="small-muted">Sem metas</div>'; return}
  state.goals.forEach(g=>{
    const info = computeGoalProgress(g);
    const wrapper = document.createElement('div');
    wrapper.className='mb-2';
    wrapper.innerHTML = `<div class="d-flex justify-content-between small-muted"><div>${escapeHtml(g.title)}</div><div>${info.total}/${g.target} ${escapeHtml(g.unit)}</div></div>
      <div class="progress progress-small mt-1"><div class="progress-bar" role="progressbar" style="width:${Math.min(info.percent,100)}%"></div></div>`;
    progressArea.appendChild(wrapper);
  })
}

function renderChart() {
  const grouped = {};
  state.activities.forEach(a=>{
    const day = a.date.split('T')[0];
    grouped[day] = (grouped[day] || 0) + Number(a.amount);
  });
  const labels = Object.keys(grouped).sort();
  const data = labels.map(l=>grouped[l]);
  if(!activitiesChart){
    activitiesChart = new Chart(chartCtx, {
      type:'line',
      data:{labels, datasets:[{label:'Quantidade (soma por dia)', data, tension:0.3, fill:true}]},
      options:{responsive:true, plugins:{legend:{display:false}}}
    });
  } else {
    activitiesChart.data.labels = labels; activitiesChart.data.datasets[0].data = data; activitiesChart.update();
  }
}

function renderSummary(){
  summaryCountEl.textContent = state.activities.length;
  renderGoals(); renderRecentActivities(); renderActivitiesTable(); renderProgressArea(); renderChart();
}

// Eventos
formGoal.addEventListener('submit', e=>{
  e.preventDefault();
  const title = document.getElementById('goalTitle').value.trim();
  const target = Number(document.getElementById('goalTarget').value);
  const unit = document.getElementById('goalUnit').value.trim() || 'un';
  if(!title || !target) return;
  state.goals.push({id:uid(), title, target, unit, progress:0, createdAt:new Date().toISOString()});
  saveState(state); renderSummary(); formGoal.reset();
});

formActivity.addEventListener('submit', e=>{
  e.preventDefault();
  const type = document.getElementById('activityType').value.trim();
  const amount = Number(document.getElementById('activityAmount').value);
  const unit = document.getElementById('activityUnit').value.trim() || 'un';
  const date = document.getElementById('activityDate').value || (new Date()).toISOString().slice(0,10);
  if(!type || !amount) return;
  state.activities.push({id:uid(), type, amount, unit, date:new Date(date).toISOString(), createdAt:new Date().toISOString()});
  saveState(state); renderSummary(); formActivity.reset();
});

// Delegação de clique
document.addEventListener('click', e=>{
  const del = e.target.closest('.btn-del');
  if(del){ state.goals = state.goals.filter(g=>g.id!==del.dataset.id); saveState(state); renderSummary(); }
  const edit = e.target.closest('.btn-edit');
  if(edit){
    const g = state.goals.find(x=>x.id===edit.dataset.id); if(!g) return;
    const newTitle = prompt('Editar título', g.title); if(newTitle!==null){ g.title = newTitle; saveState(state); renderSummary(); }
  }
  const delAct = e.target.closest('.btn-del-act');
  if(delAct){ state.activities = state.activities.filter(a=>a.id!==delAct.dataset.id); saveState(state); renderSummary(); }
});

document.getElementById('btnClearAll').addEventListener('click', ()=>{
  if(confirm('Apagar TODOS os dados salvos localmente?')){ state = structuredClone(defaultState); saveState(state); renderSummary(); }
});

document.getElementById('btnLoadSample').addEventListener('click', ()=>{
  const sampleGoal = {id:uid(), title:'Correr 50 km em 30 dias', target:50, unit:'km', createdAt:new Date().toISOString()};
  const today = new Date();
  const activities = [
    {id:uid(), type:'Corrida', amount:5, unit:'km', date:new Date(today.getTime()-4*24*3600*1000).toISOString(), createdAt:new Date().toISOString()},
    {id:uid(), type:'Corrida', amount:7, unit:'km', date:new Date(today.getTime()-3*24*3600*1000).toISOString(), createdAt:new Date().toISOString()},
    {id:uid(), type:'Corrida', amount:6, unit:'km', date:new Date(today.getTime()-1*24*3600*1000).toISOString(), createdAt:new Date().toISOString()}
  ];
  state.goals.push(sampleGoal); state.activities.push(...activities); saveState(state); renderSummary();
});

// Inicialização
(function init(){
  const d = new Date().toISOString().slice(0,10); document.getElementById('activityDate').value = d;
  renderSummary();
})();