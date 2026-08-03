/* ============================================================
   BMR 관리 콘솔 — 프런트엔드 로직
   ============================================================ */
const API = '/api/servers';
let servers = [];
let selected = new Set(); // 체크된 서버 id

// ---------- 유틸 ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  setTimeout(() => t.classList.add('hidden'), 2600);
}

async function api(method, path = '', body) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

// ---------- 목록 로드/렌더 ----------
async function loadServers() {
  servers = await api('GET');
  render();
}

function render() {
  const q = $('#searchBox').value.trim().toLowerCase();
  const list = q
    ? servers.filter((s) =>
        [s.name, s.ip, s.os, s.location, s.env].join(' ').toLowerCase().includes(q)
      )
    : servers;

  const body = $('#serverBody');
  body.innerHTML = list
    .map(
      (s) => `
    <tr data-id="${s.id}">
      <td class="col-check">
        <input type="checkbox" class="chk" data-id="${s.id}" ${selected.has(s.id) ? 'checked' : ''} />
      </td>
      <td class="col-env">
        <span class="env-badge ${esc(s.env)}">${esc(s.env || '-')}</span>
      </td>
      <td class="col-name">
        <span class="srv-name" data-editname="${s.id}" title="클릭하여 변경">${esc(s.name)}</span>
      </td>
      <td><span class="mono">${esc(s.ip || '-')}</span></td>
      <td>${esc(s.os || '-')}</td>
      <td class="col-loc">${esc(s.location || '-')}</td>
      <td class="col-note">
        <div class="note-cell">
          ${s.note ? `<span class="note-text">${esc(s.note)}</span>` : ''}
          <div class="btn-group">
            <button class="cmd-edit-btn ${s.script ? 'has-script' : ''}" data-script="${s.id}" title="원격 BMR 수행 시 실행할 명령어 편집">⌨ 명령어 편집</button>
            <button class="bmr-run-btn" data-bmr="${s.id}">원격 BMR 수행</button>
          </div>
        </div>
      </td>
    </tr>`
    )
    .join('');

  $('#emptyState').classList.toggle('hidden', servers.length !== 0);
  $('#totalCount').textContent = servers.length;
  $('#selectedCount').textContent = selected.size;
}

// ---------- 모달 헬퍼 ----------
function openModal(id) { $('#' + id).classList.remove('hidden'); }
function closeModal(id) { $('#' + id).classList.add('hidden'); }

// ---------- 등록 / 변경 폼 ----------
function openForm(server) {
  const editing = !!server;
  $('#formTitle').textContent = editing ? '서버 변경' : '서버 등록';
  $('#formSubmit').textContent = editing ? '변경 저장' : '등록';
  $('#f_id').value = editing ? server.id : '';
  $('#f_env').value = editing ? server.env || '운영' : '운영';
  $('#f_name').value = editing ? server.name || '' : '';
  $('#f_ip').value = editing ? server.ip || '' : '';
  $('#f_os').value = editing ? server.os || '' : '';
  $('#f_location').value = editing ? server.location || '' : '';
  $('#f_note').value = editing ? server.note || '' : '';
  openModal('formModal');
  setTimeout(() => $('#f_name').focus(), 50);
}

$('#serverForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    env: $('#f_env').value,
    name: $('#f_name').value.trim(),
    ip: $('#f_ip').value.trim(),
    os: $('#f_os').value.trim(),
    location: $('#f_location').value.trim(),
    note: $('#f_note').value.trim(),
  };
  if (!payload.name) return toast('서버명은 필수입니다.', true);
  const id = $('#f_id').value;
  try {
    if (id) {
      await api('PUT', '/' + id, payload);
      toast('서버 정보를 변경했습니다.');
    } else {
      await api('POST', '', payload);
      toast('서버를 등록했습니다.');
    }
    closeModal('formModal');
    await loadServers();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- 변경 대상 선택 ----------
function openEditPicker() {
  if (servers.length === 0) return toast('등록된 서버가 없습니다.', true);
  const ul = $('#editPickList');
  ul.innerHTML = servers
    .map(
      (s) => `
      <li data-edit="${s.id}">
        <span class="pl-name">${esc(s.name)}</span>
        <span class="pl-meta">${esc(s.env)} · ${esc(s.ip || '-')} · ${esc(s.os || '-')}</span>
      </li>`
    )
    .join('');
  openModal('pickEditModal');
}

// ---------- 삭제 대상 선택 ----------
function openDeletePicker() {
  if (servers.length === 0) return toast('등록된 서버가 없습니다.', true);
  const ul = $('#deleteList');
  ul.innerHTML = servers
    .map(
      (s) => `
      <li>
        <input type="checkbox" class="del-chk" data-id="${s.id}" ${selected.has(s.id) ? 'checked' : ''} />
        <span class="pl-name">${esc(s.name)}</span>
        <span class="pl-meta">${esc(s.env)} · ${esc(s.ip || '-')}</span>
      </li>`
    )
    .join('');
  // 행 클릭 시 체크박스 토글
  ul.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const cb = li.querySelector('input');
        cb.checked = !cb.checked;
      }
    });
  });
  openModal('deleteModal');
}

$('#deleteConfirm').addEventListener('click', async () => {
  const ids = [...document.querySelectorAll('.del-chk:checked')].map((c) => c.dataset.id);
  if (ids.length === 0) return toast('삭제할 서버를 선택하세요.', true);
  if (!confirm(`${ids.length}개 서버를 삭제하시겠습니까?`)) return;
  try {
    for (const id of ids) {
      await api('DELETE', '/' + id);
      selected.delete(id);
    }
    toast(`${ids.length}개 서버를 삭제했습니다.`);
    closeModal('deleteModal');
    await loadServers();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- 명령어(스크립트) 편집 모달 ----------
function openScriptEditor(server) {
  $('#scriptServerName').textContent = server.name;
  $('#s_id').value = server.id;
  $('#s_script').value = server.script || '';
  openModal('scriptModal');
  setTimeout(() => $('#s_script').focus(), 50);
}

$('#scriptSave').addEventListener('click', async () => {
  const id = $('#s_id').value;
  const srv = servers.find((s) => s.id === id);
  if (!srv) return;
  try {
    await api('PUT', '/' + id, { ...srv, script: $('#s_script').value });
    toast('명령어를 저장했습니다.');
    closeModal('scriptModal');
    await loadServers();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- 원격 BMR 수행 모달 ----------
let bmrActiveIndex = 0;
let currentBmrServer = null;
const REC_OPTIONS = [
  'Restore volumes', 'Restore files', 'Configure network',
  'Switch to command line', 'Reboot', 'Shutdown',
];

function openBmr(server) {
  currentBmrServer = server;
  // 서버 정보 요약
  $('#bmrSummary').innerHTML = [
    ['구분', server.env], ['서버명', server.name], ['IP', server.ip],
    ['OS', server.os], ['위치', server.location],
  ]
    .map(
      ([k, v]) => `<div class="summary-cell"><div class="k">${k}</div><div class="v">${esc(v || '-')}</div></div>`
    )
    .join('');

  bmrActiveIndex = 0;
  paintRecovery();
  openModal('bmrModal');
}

function paintRecovery() {
  document.querySelectorAll('#recoveryScreen .rec-list li').forEach((li, i) => {
    li.classList.toggle('active', i === bmrActiveIndex);
  });
}

// 부팅 메뉴: 위/아래 이동, Enter 선택
document.addEventListener('keydown', (e) => {
  if ($('#bmrModal').classList.contains('hidden')) return;
  if (e.key === 'ArrowDown') { bmrActiveIndex = (bmrActiveIndex + 1) % REC_OPTIONS.length; paintRecovery(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { bmrActiveIndex = (bmrActiveIndex - 1 + REC_OPTIONS.length) % REC_OPTIONS.length; paintRecovery(); e.preventDefault(); }
  if (e.key === 'Enter') { execRecovery(); e.preventDefault(); }
});

function execRecovery() {
  const opt = REC_OPTIONS[bmrActiveIndex];
  const hasScript = currentBmrServer && currentBmrServer.script && currentBmrServer.script.trim();
  const scriptNote = hasScript ? ' · 등록된 명령어 실행' : ' · 등록된 명령어 없음';
  toast(`[시뮬레이션] "${opt}"${scriptNote}`);
}

$('#bmrExecute').addEventListener('click', execRecovery);
document.querySelectorAll('#recoveryScreen .rec-list li').forEach((li, i) => {
  li.addEventListener('click', () => { bmrActiveIndex = i; paintRecovery(); });
  li.addEventListener('dblclick', execRecovery);
});

// ---------- 전역 이벤트 위임 ----------
document.addEventListener('click', (e) => {
  const t = e.target;

  // 상단 메뉴
  if (t.dataset.action === 'add') openForm(null);
  if (t.dataset.action === 'edit') openEditPicker();
  if (t.dataset.action === 'delete') openDeletePicker();

  // 모달 닫기 (X 버튼, 취소 버튼)
  if (t.dataset.close) closeModal(t.dataset.close);

  // 오버레이 클릭 시 닫기
  if (t.classList.contains('modal-overlay')) t.classList.add('hidden');

  // 서버명 클릭 → 바로 변경 창 열기
  if (t.dataset.editname) {
    const srv = servers.find((s) => s.id === t.dataset.editname);
    if (srv) openForm(srv);
  }

  // 변경 대상 선택 → 폼 열기
  const editLi = t.closest('[data-edit]');
  if (editLi) {
    const srv = servers.find((s) => s.id === editLi.dataset.edit);
    closeModal('pickEditModal');
    openForm(srv);
  }

  // 명령어 편집 버튼
  if (t.dataset.script) {
    const srv = servers.find((s) => s.id === t.dataset.script);
    if (srv) openScriptEditor(srv);
  }

  // 원격 BMR 수행 버튼
  if (t.dataset.bmr) {
    const srv = servers.find((s) => s.id === t.dataset.bmr);
    if (srv) openBmr(srv);
  }
});

// 체크박스 (BMR 구분)
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('chk')) {
    const id = e.target.dataset.id;
    if (e.target.checked) selected.add(id);
    else selected.delete(id);
    $('#selectedCount').textContent = selected.size;
  }
});

// 검색
$('#searchBox').addEventListener('input', render);

// ESC 로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden'));
});

// ---------- 초기 로드 ----------
loadServers().catch((err) => toast('데이터 로드 실패: ' + err.message, true));
