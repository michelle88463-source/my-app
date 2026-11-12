// 갈증나 — 마신 음료 기록 앱
// 기록은 이 기기 안(localStorage)에만 저장해요. 저장 이름은 바꾸지 마세요.
const RECORDS_KEY = 'my-app-galjeungna-records';
const SETTINGS_KEY = 'my-app-galjeungna-settings';

const TYPES = [
  { id: 'water',  name: '물',   emoji: '💧', color: '#0284C7', ml: 250 },
  { id: 'coffee', name: '커피', emoji: '☕', color: '#8B5A2B', ml: 200 },
  { id: 'tea',    name: '차',   emoji: '🍵', color: '#3F8F4F', ml: 200 },
  { id: 'etc',    name: '기타', emoji: '🥤', color: '#C2410C', ml: 250 },
];
const ML_OPTIONS = [100, 150, 200, 250, 300, 500];
const typeById = id => TYPES.find(t => t.id === id) || TYPES[3];

// ---------- 저장 ----------
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let records = load(RECORDS_KEY, []);            // [{ id, t, type, ml }]
let settings = Object.assign({
  type: 'water',
  ml: { water: 250, coffee: 200, tea: 200, etc: 250 },
  goal: 2000,
  times: [],                                     // ['09:00', ...]
}, load(SETTINGS_KEY, {}));

const saveRecords = () => save(RECORDS_KEY, records);
const saveSettings = () => save(SETTINGS_KEY, settings);

// ---------- 날짜 도우미 ----------
const $ = id => document.getElementById(id);
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtNum = n => n.toLocaleString('ko-KR');
const pad = n => String(n).padStart(2, '0');
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const fmtDate = d => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;

function between(from, to) {
  const a = from.getTime(), b = to.getTime();
  return records.filter(r => r.t >= a && r.t < b);
}
function sumByType(list) {
  const out = {};
  TYPES.forEach(t => out[t.id] = { count: 0, ml: 0 });
  list.forEach(r => { const s = out[r.type] || out.etc; s.count++; s.ml += r.ml; });
  return out;
}

// ---------- 짧은 안내 ----------
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- "정말 지울까요?" ----------
function askDelete(detail) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'confirm';
    wrap.innerHTML = `
      <div class="confirm-box" role="alertdialog" aria-modal="true">
        <p>정말 지울까요?</p>
        <small></small>
        <div class="confirm-btns">
          <button class="no">아니요</button>
          <button class="yes">지울게요</button>
        </div>
      </div>`;
    wrap.querySelector('small').textContent = detail || '';
    const done = v => { wrap.remove(); resolve(v); };
    wrap.querySelector('.no').onclick = () => done(false);
    wrap.querySelector('.yes').onclick = () => done(true);
    wrap.addEventListener('click', e => { if (e.target === wrap) done(false); });
    document.body.appendChild(wrap);
    wrap.querySelector('.no').focus();
  });
}

// ---------- 아래쪽 고르기 버튼 ----------
function renderChips() {
  const typeBox = $('typeChips');
  typeBox.innerHTML = '';
  TYPES.forEach(t => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.dataset.type = t.id;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(settings.type === t.id));
    b.textContent = `${t.emoji} ${t.name}`;
    b.onclick = () => { settings.type = t.id; saveSettings(); renderChips(); };
    typeBox.appendChild(b);
  });

  const mlBox = $('mlChips');
  mlBox.innerHTML = '';
  const cur = settings.ml[settings.type] ?? typeById(settings.type).ml;
  ML_OPTIONS.forEach(ml => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(cur === ml));
    b.textContent = `${ml}ml`;
    b.onclick = () => { settings.ml[settings.type] = ml; saveSettings(); renderChips(); };
    mlBox.appendChild(b);
  });

  const t = typeById(settings.type);
  $('drinkBtn').textContent = `+ 한잔`;
  $('drinkBtn').setAttribute('aria-label', `${t.name} ${cur}ml 한잔 마셨어요`);
}

// ---------- 오늘 기록 ----------
function renderToday() {
  const today = startOfDay(new Date());
  const list = between(today, addDays(today, 1));
  const sums = sumByType(list);
  const totalMl = list.reduce((a, r) => a + r.ml, 0);

  $('todayDate').textContent = `오늘 · ${fmtDate(today)}`;
  $('todayCount').textContent = fmtNum(list.length);
  $('todayMl').textContent = fmtNum(totalMl);

  const water = sums.water.ml;
  $('goalText').textContent = `${fmtNum(water)} / ${fmtNum(settings.goal)}ml`;
  $('gaugeRing').style.setProperty('--p', Math.min(100, water / settings.goal * 100) + '%');

  $('typeTotals').innerHTML = TYPES.map(t => `
    <li>
      <span class="t-name"><span class="dot" style="background:${t.color}"></span>${t.emoji} ${t.name}</span>
      <span class="t-val">${sums[t.id].count}잔 · ${fmtNum(sums[t.id].ml)}ml</span>
    </li>`).join('');

  const ul = $('todayLog');
  ul.innerHTML = '';
  [...list].sort((a, b) => b.t - a.t).forEach(r => {
    const t = typeById(r.type);
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="time">${hhmm(new Date(r.t))}</span>
      <span class="what"><span class="dot" style="background:${t.color}"></span>${t.name} ${r.ml}ml</span>
      <button class="del-btn">지우기</button>`;
    li.querySelector('.del-btn').onclick = async () => {
      if (await askDelete(`${hhmm(new Date(r.t))} ${t.name} ${r.ml}ml`)) {
        records = records.filter(x => x.id !== r.id);
        saveRecords();
        renderAll();
        toast('지웠어요');
      }
    };
    ul.appendChild(li);
  });
  $('emptyLog').hidden = list.length > 0;
}

// ---------- 물방울 소리 (파일 없이 소리를 만들어요) ----------
let audioCtx;
function dropSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    // 큰 물방울 하나 + 작은 물방울 하나 ("똑-똑")
    [[0, 520, 1500, 0.35], [0.11, 800, 2000, 0.15]].forEach(([delay, f1, f2, vol]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = now + delay;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f1, t);
      osc.frequency.exponentialRampToValueAtTime(f2, t + 0.08);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch {}
}

// ---------- 한잔 마셨어요 ----------
// 앱 안의 모든 버튼: 누를 때마다 물방울 소리 (나중에 생기는 버튼도 똑같이)
document.addEventListener('click', e => {
  if (e.target.closest('button')) dropSound();
}, true);

$('drinkBtn').onclick = () => {
  const type = settings.type;
  const ml = settings.ml[type] ?? typeById(type).ml;
  const now = Date.now();
  records.push({ id: now.toString(36) + Math.random().toString(36).slice(2, 6), t: now, type, ml });
  saveRecords();
  renderAll();
  if (navigator.vibrate) navigator.vibrate(30);
  toast(`${typeById(type).emoji} ${typeById(type).name} ${ml}ml 기록했어요`);
};

// ---------- 기록 보기 (1일 · 1주 · 1달) ----------
let period = 'day';

function renderStats() {
  const now = new Date();
  const today = startOfDay(now);
  let from, to = addDays(today, 1), buckets = [], label;

  if (period === 'day') {
    from = today;
    label = `오늘 · ${fmtDate(today)}`;
    for (let h = 0; h < 24; h++) {
      const a = new Date(today); a.setHours(h);
      const b = new Date(today); b.setHours(h + 1);
      buckets.push({ from: a, to: b, label: h % 6 === 0 ? `${h}시` : '' });
    }
    $('chartTitle').textContent = '시간별 마신 양';
  } else {
    const days = period === 'week' ? 7 : 30;
    from = addDays(today, -(days - 1));
    label = `${fmtDate(from)} ~ ${fmtDate(today)} (${days}일)`;
    for (let i = 0; i < days; i++) {
      const a = addDays(from, i);
      const show = days === 7 || i % 5 === 4 || i === days - 1;
      buckets.push({
        from: a, to: addDays(a, 1),
        label: show ? (days === 7 ? WEEK[a.getDay()] : `${a.getDate()}`) : '',
      });
    }
    $('chartTitle').textContent = '날짜별 마신 양';
  }

  $('periodLabel').textContent = label;

  const list = between(from, to);
  const sums = sumByType(list);
  const totalMl = list.reduce((a, r) => a + r.ml, 0);
  $('statBody').innerHTML = TYPES.map(t => `
    <tr>
      <td><span class="dot" style="background:${t.color}"></span>${t.name}</td>
      <td>${fmtNum(sums[t.id].count)}잔</td>
      <td>${fmtNum(sums[t.id].ml)}ml</td>
    </tr>`).join('') + `
    <tr class="total"><td>모두</td><td>${fmtNum(list.length)}잔</td><td>${fmtNum(totalMl)}ml</td></tr>`;

  // 막대 그래프 (종류별 색으로 쌓기)
  const data = buckets.map(b => sumByType(between(b.from, b.to)));
  const max = Math.max(1, ...data.map(s => TYPES.reduce((a, t) => a + s[t.id].ml, 0)));
  const chart = $('chart');
  if (list.length === 0) {
    chart.innerHTML = '<p class="chart-empty">이 기간에는 기록이 없어요</p>';
  } else {
    chart.innerHTML = data.map(s => {
      const total = TYPES.reduce((a, t) => a + s[t.id].ml, 0);
      const segs = TYPES.filter(t => s[t.id].ml > 0)
        .map(t => `<div style="height:${s[t.id].ml / total * 100}%;background:${t.color}"></div>`).join('');
      return `<div class="col" title="${fmtNum(total)}ml"><div class="stack" style="height:${total / max * 100}%">${segs}</div></div>`;
    }).join('');
  }
  let axis = chart.nextElementSibling;
  if (!axis || !axis.classList.contains('axis')) {
    axis = document.createElement('div');
    axis.className = 'axis';
    chart.after(axis);
  }
  axis.innerHTML = buckets.map(b => `<span>${b.label}</span>`).join('');
  axis.hidden = list.length === 0;

  $('legend').innerHTML = TYPES.map(t =>
    `<span><span class="dot" style="background:${t.color}"></span>${t.name}</span>`).join('') +
    `<span style="color:var(--muted)">가장 높은 막대 ${fmtNum(max)}ml</span>`;
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    period = tab.dataset.period;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === tab));
    renderStats();
  };
});

// ---------- 아래에서 올라오는 화면 열고 닫기 ----------
function openSheet(id) { $(id).hidden = false; }
document.querySelectorAll('.sheet').forEach(sheet => {
  sheet.addEventListener('click', e => {
    if (e.target === sheet || e.target.hasAttribute('data-close')) sheet.hidden = true;
  });
});
$('openStats').onclick = () => { renderStats(); openSheet('statsSheet'); };
$('openSettings').onclick = () => { renderSettings(); openSheet('settingsSheet'); };

// ---------- 알림과 설정 ----------
function renderSettings() {
  const ul = $('timeList');
  ul.innerHTML = '';
  if (settings.times.length === 0) {
    ul.innerHTML = '<li class="hint" style="font-size:17px;font-weight:400">아직 정한 시간이 없어요</li>';
  }
  settings.times.forEach(time => {
    const li = document.createElement('li');
    li.innerHTML = `<span>⏰ ${time}</span><button class="del-btn">지우기</button>`;
    li.querySelector('.del-btn').onclick = async () => {
      if (await askDelete(`${time} 알림`)) {
        settings.times = settings.times.filter(x => x !== time);
        saveSettings();
        renderSettings();
      }
    };
    ul.appendChild(li);
  });

  $('goalInput').value = settings.goal;

  const state = !('Notification' in window) ? 'unsupported' : Notification.permission;
  $('notifyState').textContent = {
    granted: '✅ 휴대폰 알림이 허락되어 있어요.',
    denied: '🚫 알림이 막혀 있어요. 휴대폰 설정에서 이 앱의 알림을 켜 주세요. (그동안은 앱 화면에만 안내가 떠요)',
    default: '아래 버튼을 눌러 휴대폰 알림을 허락해 주세요.',
    unsupported: '이 화면에서는 휴대폰 알림을 쓸 수 없어요. 홈 화면에 설치하면 쓸 수 있어요. (그동안은 앱 화면에만 안내가 떠요)',
  }[state];
  $('askNotify').hidden = state !== 'default';
}

$('addTime').onclick = () => {
  const v = $('newTime').value;
  if (!v) return;
  if (settings.times.includes(v)) { toast('이미 있는 시간이에요'); return; }
  settings.times.push(v);
  settings.times.sort();
  saveSettings();
  renderSettings();
  toast(`${v} 알림을 추가했어요`);
};

$('askNotify').onclick = async () => {
  try { await Notification.requestPermission(); } catch {}
  renderSettings();
};

$('saveGoal').onclick = () => {
  const v = Math.round(Number($('goalInput').value));
  if (!v || v < 100 || v > 10000) { toast('100~10000 사이로 적어 주세요'); return; }
  settings.goal = v;
  saveSettings();
  renderAll();
  toast(`물 목표를 ${fmtNum(v)}ml로 바꿨어요`);
};

$('clearToday').onclick = async () => {
  const today = startOfDay(new Date()).getTime();
  const n = records.filter(r => r.t >= today).length;
  if (n === 0) { toast('오늘 기록이 없어요'); return; }
  if (await askDelete(`오늘 기록 ${n}개를 모두 지워요`)) {
    records = records.filter(r => r.t < today);
    saveRecords();
    renderAll();
    toast('오늘 기록을 지웠어요');
  }
};

// ---------- 물 마실 시간 알림 확인 (앱이 열려 있는 동안) ----------
const fired = new Set();
async function checkReminders() {
  const now = new Date();
  const key = hhmm(now);
  const dayKey = now.toDateString() + key;
  if (!settings.times.includes(key) || fired.has(dayKey)) return;
  fired.add(dayKey);

  const msg = '물 한 잔 마실 시간이에요! 💧';
  toast(msg);
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const opts = { body: '마시고 나서 "+ 한잔"을 눌러 주세요.', icon: './icon-192.png', badge: './icon-192.png', tag: 'drink-' + key };
      if (reg) await reg.showNotification('갈증나', opts);
      else new Notification('갈증나', opts);
    } catch {}
  }
}
setInterval(checkReminders, 15000);

// ---------- 화면 다시 그리기 ----------
function renderAll() {
  renderToday();
  if (!$('statsSheet').hidden) renderStats();
}

// 자정이 지나거나 앱으로 돌아왔을 때 새로 그리기
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { records = load(RECORDS_KEY, []); renderAll(); checkReminders(); }
});

renderChips();
renderAll();
checkReminders();

// ---------- 서비스 워커 (휴대폰 설치 · 자동 업데이트) ----------
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 새 버전이 적용되면 화면을 한 번만 자동으로 새로고침
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {});
  });
}
