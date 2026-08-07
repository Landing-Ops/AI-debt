/* =====================================================================
   thanks-uid-resolver.js — 땡큐페이지 uid 조회 + 이름 치환 + 만료 분기
   - URL의 ?uid= 를 서버(/lookup)로 조회 → 이름 치환 + 남은시간(remainMs) 확보
   - 정상: window.__THANKS_REMAIN_MS__ 채우고 'thanks:uid-resolved' 발행
           (thanks-countdown.js가 이 값으로 카운트다운 시작)
   - 만료/미존재/uid없음: 콘텐츠 숨기고 만료 화면 표시
   - 응답 지연 대비 1회 재시도(느린 왕복에 바로 폴백하면 이름 없이 뜨는 문제)
   - ★뒤로가기→앞으로가기로 페이지 재등장 시 서버 재조회(persisted 무관).
     first_view는 서버에 고정돼 있으므로 재조회하면 남은시간이 이어짐
     (PC는 bfcache 복원/재로드가 뒤섞여 15분이 리셋되던 문제 해결)
===================================================================== */
(function () {
  'use strict';

  var LOOKUP_URL   = 'https://ai-debt.softman007.workers.dev/lookup';
  var TIMEOUT_MS   = 10000;
  var MAX_ATTEMPTS = 2;   // 최초 1 + 재시도 1

  var overlay        = document.getElementById('uid-loading-overlay');
  var contentFull    = document.querySelector('[data-content-full]');
  var contentExpired = document.querySelector('[data-content-expired]');

  var params = new URLSearchParams(window.location.search);
  var uid = (params.get('uid') || '').trim();

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  function replaceName(name) {
    if (!name) return;
    document.querySelectorAll('[data-name-slot]').forEach(function (el) {
      el.textContent = name;
    });
  }

  function showExpired() {
    if (contentFull) contentFull.hidden = true;
    if (contentExpired) contentExpired.hidden = false;
    hideOverlay();
    window.__THANKS_EXPIRED__ = true;
    window.__THANKS_UID_RESOLVED__ = true;
    document.dispatchEvent(new CustomEvent('thanks:uid-resolved'));
  }

  function showContent(remainMs) {
    if (typeof remainMs === 'number') window.__THANKS_REMAIN_MS__ = remainMs;
    hideOverlay();
    window.__THANKS_UID_RESOLVED__ = true;
    document.dispatchEvent(new CustomEvent('thanks:uid-resolved'));
  }

  /* ---------- lookup 호출 (fetch, 재시도 포함) ----------
     isRefresh=true 면 bfcache 복원 재조회 → 'thanks:uid-refreshed'로 알림 */
  function attemptLookup(attemptNo, isRefresh) {
    var settled = false;
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;

    var timeoutId = setTimeout(function () {
      if (settled) return;
      settled = true;
      if (controller) controller.abort();
      if (attemptNo < MAX_ATTEMPTS) attemptLookup(attemptNo + 1, isRefresh);
      else if (!isRefresh) showContent();   // 최초 로드만 폴백(재조회 실패는 기존 화면 유지)
    }, TIMEOUT_MS);

    function onResult(data) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      if (data && data.ok) {
        replaceName(data.name);
        if (isRefresh) {
          // 복원 재조회: 남은시간만 갱신하고 카운트다운에 다시 그리라고 알림
          if (typeof data.remainMs === 'number') window.__THANKS_REMAIN_MS__ = data.remainMs;
          document.dispatchEvent(new CustomEvent('thanks:uid-refreshed'));
        } else {
          showContent(data.remainMs);
        }
      } else {
        // 만료/미존재 — 재조회 중이든 최초든 만료 화면으로
        showExpired();
      }
    }

    var opts = {};
    if (controller) opts.signal = controller.signal;

    fetch(LOOKUP_URL + '?uid=' + encodeURIComponent(uid), opts)
      .then(function (r) { return r.json(); })
      .then(onResult)
      .catch(function () {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (attemptNo < MAX_ATTEMPTS) attemptLookup(attemptNo + 1, isRefresh);
        else if (!isRefresh) showContent();
      });
  }

  /* ---------- 시작 ---------- */
  if (!uid) {
    showExpired();
    return;
  }

  // 이름 즉시 렌더(lookup 응답 대기 없이 — sessionStorage 캐시)
  try {
    var cachedName = sessionStorage.getItem('lead_name');
    if (cachedName) replaceName(cachedName);
  } catch (e) {}

  attemptLookup(1, false);

  // ★뒤로가기→앞으로가기로 페이지가 다시 보일 때 서버 재조회.
  // persisted(bfcache)로만 한정하면 PC 크롬이 bfcache를 안 쓰는 경우 놓치므로,
  // 최초 로드(직후 발생하는 pageshow 1회)만 걸러내고 그 뒤 재등장은 모두 재조회.
  var firstShow = true;
  window.addEventListener('pageshow', function () {
    if (firstShow) { firstShow = false; return; }  // 최초 로드분은 위 attemptLookup(1,false)가 이미 처리
    if (!window.__THANKS_EXPIRED__) attemptLookup(1, true);
  });
})();
