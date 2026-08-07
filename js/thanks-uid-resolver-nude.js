/* =====================================================================
   thanks-uid-resolver.js — 땡큐페이지 uid 조회 + 이름 치환 + 만료 분기
   - URL의 ?uid= 파싱 → 웹앱2 lookup(JSONP)로 서버 조회
   - 정상: 이름 치환 + remainMs를 window.__THANKS_REMAIN_MS__ 에 저장
           (thanks-countdown.js가 이 값을 읽어서 카운트다운 시작)
   - 만료/미존재/uid없음: data-content-full 숨기고 data-content-expired 표시
   - 응답 지연 대비: 1차 시도가 TIMEOUT_MS 안에 안 오면 1회 재시도.
     (뒤로가기→재진입 등으로 서버가 일시적으로 느릴 때, 재시도 없이 바로
      폴백해버리면 "이름 없음 + 카운트다운 리셋"처럼 보이는 문제가 있었음)
     재시도까지 실패하면 그제서야 폴백(이름 없이 콘텐츠 표시, 20분 시작)
===================================================================== */
(function () {
  'use strict';

  var LOOKUP_URL   = 'https://ai-debt.softman007.workers.dev/lookup'; // 5단계: Workers /lookup → D1 (GAS 웹앱2 대체)
  var TIMEOUT_MS   = 10000;
  var MAX_ATTEMPTS = 2;   // 최초 시도 1 + 재시도 1

  var overlay       = document.getElementById('uid-loading-overlay');
  var contentFull    = document.querySelector('[data-content-full]');
  var contentExpired = document.querySelector('[data-content-expired]');

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  function showExpired() {
    if (contentFull) contentFull.hidden = true;
    if (contentExpired) contentExpired.hidden = false;
    hideOverlay();
    window.__THANKS_EXPIRED__ = true;
    window.__THANKS_UID_RESOLVED__ = true;
    document.dispatchEvent(new CustomEvent('thanks:uid-resolved'));
  }

  function replaceName(name) {
    if (!name) return;
    document.querySelectorAll('[data-name-slot]').forEach(function (el) {
      el.textContent = name;
    });
  }
  function showContent(remainMs) {
    if (typeof remainMs === 'number') {
      window.__THANKS_REMAIN_MS__ = remainMs;
    }
    hideOverlay();
    window.__THANKS_UID_RESOLVED__ = true;
    document.dispatchEvent(new CustomEvent('thanks:uid-resolved'));
  }

  /* ---------- uid 파싱 ---------- */
  var params = new URLSearchParams(window.location.search);
  var uid = (params.get('uid') || '').trim();

  if (!uid) {
    showExpired();
    return;
  }

  /* ---------- lookup 호출 (fetch, 재시도 포함) ---------- */
  function attemptLookup(attemptNo) {
    // 5단계: JSONP → fetch(GET). worker /lookup은 CORS 열려있어 정석 사용.
    var settled = false;
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;

    var timeoutId = setTimeout(function () {
      if (settled) return;
      settled = true;
      if (controller) controller.abort();
      if (attemptNo < MAX_ATTEMPTS) {
        attemptLookup(attemptNo + 1);   // ★ 재시도
      } else {
        // 재시도까지 실패 → 이름 없이 콘텐츠부터 보여줌 (무한로딩 방지)
        showContent();
      }
    }, TIMEOUT_MS);

    function onResult(data) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (data && data.ok) {
        replaceName(data.name);
        showContent(data.remainMs);
      } else {
        // reason: 'expired' | 'not_found' 등 — 어떤 사유든 만료 화면으로
        showExpired();
      }
    }

    var reqUrl = LOOKUP_URL + '?uid=' + encodeURIComponent(uid);
    var opts = {};
    if (controller) opts.signal = controller.signal;

    fetch(reqUrl, opts)
      .then(function (r) { return r.json(); })
      .then(function (data) { onResult(data); })
      .catch(function () {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (attemptNo < MAX_ATTEMPTS) {
          attemptLookup(attemptNo + 1);   // ★ 재시도
        } else {
          showContent();
        }
      });
  }

  /* ---------- 이름 즉시 렌더 (lookup 응답 대기 없이) ---------- */
  try {
    var cachedName = sessionStorage.getItem('lead_name');
    if (cachedName) replaceName(cachedName);
  } catch (e) {}

  attemptLookup(1);
})();