/* =====================================================================
   thanks-countdown.js — 제한시간 띠배너 카운트다운 (서버값 기반)
   - thanks-uid-resolver.js 가 uid 조회(JSONP, 비동기)를 끝내면
     'thanks:uid-resolved' 이벤트를 쏘고, window.__THANKS_REMAIN_MS__ 를 채워둠
   - 이 스크립트는 그 이벤트를 기다렸다가 카운트다운을 시작함
     (resolver는 네트워크 왕복이 필요한 비동기 작업이라, <script> 로드 순서만으론
      값이 준비됐음을 보장 못 함 — 그래서 이벤트로 명시적으로 동기화)
   - sessionStorage 방식은 더 이상 쓰지 않음 (최초열람시각은 서버가 기준)
   - 15분 만료 시: 팝업이 아니라 uid 없는 결과 페이지로 리다이렉트
     (result.html이 uid 없으면 자동으로 만료 안내 화면을 보여줌)
===================================================================== */
(function () {
  'use strict';

  var bar    = document.querySelector('[data-countdown-bar]');
  var timeEl = document.querySelector('[data-countdown-time]');
  if (!bar || !timeEl) return;   // 배너 없으면 아무것도 안 함 (다른 페이지 안전)

  var LIMIT_MIN = 15;                 // ★ 열람 제한시간(분) — 서버(EXPIRE_MIN)와 반드시 동일하게 유지
  var LIMIT_MS  = LIMIT_MIN * 60 * 1000;

  function boot() {
    // uid-resolver가 이미 만료/미존재로 판정한 경우 → 카운트다운 자체를 시작하지 않음
    if (window.__THANKS_EXPIRED__) {
      bar.classList.add('is-hidden');
      return;
    }

    var remainMs = (typeof window.__THANKS_REMAIN_MS__ === 'number')
      ? window.__THANKS_REMAIN_MS__
      : LIMIT_MS;   // uid-resolver가 값을 못 준 경우(타임아웃 등) 20분으로 폴백

    // "남은시간"을 "시작시각 기준 경과시간 계산" 방식으로 다루기 위해 가상의 시작시각을 역산
    var startAt = Date.now() - (LIMIT_MS - remainMs);

    document.body.classList.add('has-ttl-bar');

    function format(ms) {
      if (ms < 0) ms = 0;
      var totalSec = Math.floor(ms / 1000);
      var m = Math.floor(totalSec / 60);
      var s = totalSec % 60;
      return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    var timer = null;

    function tick() {
      var elapsed = Date.now() - startAt;
      var remain = LIMIT_MS - elapsed;

      if (remain <= 0) {
        timeEl.textContent = '00:00';
        stop();
        expire();
        return;
      }
      timeEl.textContent = format(remain);
    }

    function start() {
      tick();                       // 즉시 1회
      timer = setInterval(tick, 1000);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    /* 만료 처리: uid 없는 결과 페이지로 리다이렉트 */
    function expire() {
      var url = new URL(window.location.href);
      url.searchParams.delete('uid');
      window.location.href = url.toString();
    }

    start();
  }

  // resolver가 이미 처리를 끝내고 이벤트를 쐈을 수도 있으므로(레이스 방지),
  // 플래그가 이미 서 있으면 이벤트를 기다리지 않고 바로 시작
  if (window.__THANKS_UID_RESOLVED__) {
    boot();
  } else {
    document.addEventListener('thanks:uid-resolved', boot, { once: true });
  }
})();