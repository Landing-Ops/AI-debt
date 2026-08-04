/* =====================================================================
   diagnosis.js — AI 자가진단 컨트롤러 (한 파일 화면 전환)
   ---------------------------------------------------------------------
   [역할]
   시작 + Q1~Q7 + 로딩, 총 9개 화면(.dx__screen)을 한 파일에서 즉시 전환.
   - 답변은 각 화면 data-step 키로 sessionStorage에 저장 (q_region 등)
   - 뒤로가기: 상단 ‹ 버튼과 브라우저 back(popstate)이 같은 동작.
     history.pushState로 각 화면을 히스토리에 쌓아 두 경로를 일치시킴
   - [다음으로]는 답을 해야 활성화 (미선택/미입력 시 disabled)
   - 마지막 Q7 → 로딩 화면 2초 → result.html 이동
   ※ 계산로직(7단계)은 결과페이지에서 처리. 여기선 저장만 담당.

   [기술구현 기획안 4번 저장 이름표]
   q_region / q_marital / q_dependents / q_income / q_assets /
   q_secured / q_immunity / q_debt
   (Q2는 혼인여부 q_marital + 부양가족수 q_dependents 두 값을 한 화면에서 저장)
===================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-dx="root"]');
  if (!root) return;

  var screens = Array.prototype.slice.call(root.querySelectorAll('.dx__screen'));
  if (!screens.length) return;

  var LOADING_MS = 2000;
  var RESULT_URL = './result-nude.html';

  /* ---------- 현재 화면 인덱스 ---------- */
  var current = 0;
  screens.forEach(function (s, i) { if (s.classList.contains('is-active')) current = i; });

  function stepKey(i) { return screens[i].getAttribute('data-step'); }

  /* =====================================================================
     화면 전환 (즉시)
  ===================================================================== */
  function render(i) {
    screens.forEach(function (s, si) { s.classList.toggle('is-active', si === i); });
    current = i;
    // 접근성: 새 화면 최상단으로 포커스 이동 대비 스크롤 리셋
    window.scrollTo(0, 0);
    var active = screens[i];
    if (active.hasAttribute('data-terminal')) runTerminal(active);
    else syncNextButton(active);
  }

  /* pushState로 히스토리에 쌓으며 앞으로 이동 */
  function goForward(i) {
    if (i >= screens.length) return;
    history.pushState({ dx: i }, '', '#' + stepKey(i));
    render(i);
  }

  /* 뒤로 이동 (상단 ‹ 버튼용) — history.back()을 호출해
     popstate 경로와 완전히 동일하게 처리 (두 경로 일치) */
  function goBack() {
    if (current === 0) {
      // 진단 첫 화면(intro)에서 뒤로 → 랜딩으로
      window.location.href = './index.html';
      return;
    }
    history.back();
  }

  /* 브라우저 뒤로/앞으로 (popstate) — state의 인덱스로 렌더 */
  window.addEventListener('popstate', function (e) {
    var i = (e.state && typeof e.state.dx === 'number') ? e.state.dx : 0;
    render(i);
  });

  /* 첫 진입 시 intro를 히스토리 baseline으로 심어둠 */
  history.replaceState({ dx: current }, '', '#' + stepKey(current));

  /* =====================================================================
     저장 (sessionStorage)
  ===================================================================== */
  function save(key, val) { try { sessionStorage.setItem(key, val); } catch (e) {} }
  function load(key)      { try { return sessionStorage.getItem(key); } catch (e) { return null; } }

  /* =====================================================================
     [다음으로] 버튼 활성/비활성 — 화면 답변 유형별 검증
  ===================================================================== */
  function isAnswered(screen) {
    var type = screen.getAttribute('data-answer-type');
    var key  = screen.getAttribute('data-step');

    if (!type) return true;                       // intro 등 답변 없는 화면

    if (type === 'select') {
      return !!load(key);
    }
    if (type === 'money') {
      var raw = load(key);
      if (raw === null || raw === '') return false;
      var n = parseInt(raw, 10);
      if (isNaN(n)) return false;
      // 재산(Q4)은 0 허용, 나머지 금액은 1원 이상
      return screen.hasAttribute('data-allow-zero') ? n >= 0 : n > 0;
    }
    if (type === 'custom') {                       // Q2: 혼인 + 부양가족 둘 다
      return !!load('q_marital') && !!load('q_dependents');
    }
    return true;
  }

  function syncNextButton(screen) {
    var btn = screen.querySelector('[data-dx="next"]');
    if (!btn) return;
    // intro의 '시작하기'는 항상 활성
    if (screen.hasAttribute('data-first')) { btn.disabled = false; return; }
    btn.disabled = !isAnswered(screen);
  }

  /* =====================================================================
     답변 입력 핸들러 (이벤트 위임)
  ===================================================================== */

  /* --- 선택형 옵션 (Q1·Q5·Q6) --- */
  function bindSelect(screen) {
    var wrap = screen.querySelector('[data-dx="options"]');
    if (!wrap) return;
    var key = screen.getAttribute('data-step');
    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('.opt');
      if (!btn) return;
      wrap.querySelectorAll('.opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      save(key, btn.getAttribute('data-value'));
      syncNextButton(screen);
    });
  }

  /* --- Q2 커스텀: 혼인여부(순차공개) + 부양가족수 --- */
  function bindFamily(screen) {
    var marital = screen.querySelector('[data-dx="marital"]');
    var depWrap = screen.querySelector('[data-dx="dependents-wrap"]');
    var dep     = screen.querySelector('[data-dx="dependents"]');
    if (!marital || !dep) return;

    marital.addEventListener('click', function (e) {
      var btn = e.target.closest('.opt');
      if (!btn) return;
      marital.querySelectorAll('.opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      save('q_marital', btn.getAttribute('data-value'));
      depWrap.classList.add('is-shown');          // 순차 공개(페이드인)
      syncNextButton(screen);
    });

    dep.addEventListener('click', function (e) {
      var btn = e.target.closest('.opt');
      if (!btn) return;
      dep.querySelectorAll('.opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      save('q_dependents', btn.getAttribute('data-value'));
      syncNextButton(screen);
    });
  }

  /* --- 금액 입력 (Q3·Q4·Q7): 자릿수 쉼표 + 한글 환산 --- */
  function bindMoney(screen) {
    var input = screen.querySelector('[data-dx="money"]');
    var korEl = screen.querySelector('[data-dx="money-kor"]');
    if (!input) return;
    var key = screen.getAttribute('data-step');

    input.addEventListener('input', function () {
      var digits = input.value.replace(/[^\d]/g, '');
      if (digits.length > 12) digits = digits.slice(0, 12);   // 상한 방어
      input.value = digits ? Number(digits).toLocaleString() : '';
      save(key, digits);                                       // 순수 숫자 문자열로 저장
      if (korEl) korEl.textContent = digits ? toKorean(Number(digits)) : '';
      syncNextButton(screen);
    });
  }

  /* 숫자 → 한글 환산 (예: 23000000 → "2,300만 원") */
  function toKorean(n) {
    if (n <= 0) return '';
    var eok = Math.floor(n / 100000000);
    var man = Math.floor((n % 100000000) / 10000);
    var parts = [];
    if (eok) parts.push(eok.toLocaleString() + '억');
    if (man) parts.push(man.toLocaleString() + '만');
    if (!parts.length) return n.toLocaleString() + ' 원';
    return parts.join(' ') + ' 원';
  }

  /* =====================================================================
     각 화면에 핸들러 바인딩 + 저장값 복원(뒤로 왔을 때 선택 유지)
  ===================================================================== */
  screens.forEach(function (screen) {
    var type = screen.getAttribute('data-answer-type');
    if (type === 'select') bindSelect(screen);
    if (type === 'custom') bindFamily(screen);
    if (type === 'money')  bindMoney(screen);
    restore(screen);
  });

  /* 저장돼 있던 답을 화면에 다시 반영 */
  function restore(screen) {
    var type = screen.getAttribute('data-answer-type');
    var key  = screen.getAttribute('data-step');

    if (type === 'select') {
      var v = load(key);
      if (v) {
        var b = screen.querySelector('[data-dx="options"] .opt[data-value="' + cssEsc(v) + '"]');
        if (b) b.setAttribute('aria-pressed', 'true');
      }
    } else if (type === 'custom') {
      var m = load('q_marital');
      if (m) {
        var mb = screen.querySelector('[data-dx="marital"] .opt[data-value="' + cssEsc(m) + '"]');
        if (mb) mb.setAttribute('aria-pressed', 'true');
        screen.querySelector('[data-dx="dependents-wrap"]').classList.add('is-shown');
      }
      var d = load('q_dependents');
      if (d) {
        var db = screen.querySelector('[data-dx="dependents"] .opt[data-value="' + cssEsc(d) + '"]');
        if (db) db.setAttribute('aria-pressed', 'true');
      }
    } else if (type === 'money') {
      var raw = load(key);
      if (raw) {
        var input = screen.querySelector('[data-dx="money"]');
        var korEl = screen.querySelector('[data-dx="money-kor"]');
        input.value = Number(raw).toLocaleString();
        if (korEl) korEl.textContent = toKorean(Number(raw));
      }
    }
  }

  // data-value에 특수문자(·) 등이 들어가므로 안전하게 이스케이프
  function cssEsc(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
  }

  /* =====================================================================
     네비게이션 버튼 (위임)
  ===================================================================== */
  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-dx="next"]')) {
      var screen = screens[current];
      if (!screen.hasAttribute('data-first') && !isAnswered(screen)) return;
      goForward(current + 1);
    } else if (e.target.closest('[data-dx="back"]')) {
      goBack();
    }
  });

  /* =====================================================================
     로딩 화면 (terminal): 2초 연출 후 결과페이지 이동
  ===================================================================== */
  function runTerminal(screen) {
    setTimeout(function () {
      // 로딩은 히스토리에서 대체(replace) — 뒤로가기로 로딩에 다시 안 걸리게
      window.location.replace(RESULT_URL);
    }, LOADING_MS);
  }

  /* 초기 화면 버튼 상태 동기화 */
  syncNextButton(screens[current]);

})();
