/* =====================================================================
   thanks-countdown.js — 제한시간 띠배너 카운트다운 (서버값 기반)
   - resolver가 uid 조회를 끝내면 'thanks:uid-resolved'를 쏘고
     window.__THANKS_REMAIN_MS__(남은시간)를 채워둠 → 이 값으로 시작
   - ★뒤로가기→앞으로가기(bfcache 복원) 시 resolver가 서버 재조회 후
     'thanks:uid-refreshed'를 쏨 → 최신 남은시간으로 다시 그림
     (PC에서 카운트다운이 15분으로 리셋되던 문제 해결)
   - 만료 시: uid 없는 결과 페이지로 리다이렉트(만료 안내 화면)
===================================================================== */
(function () {
  'use strict';

  var bar    = document.querySelector('[data-countdown-bar]');
  var timeEl = document.querySelector('[data-countdown-time]');
  if (!bar || !timeEl) return;   // 배너 없는 페이지 안전

  var LIMIT_MIN = 15;                 // ★ 서버(LOOKUP_EXPIRE_MIN)와 반드시 동일
  var LIMIT_MS  = LIMIT_MIN * 60 * 1000;

  var timer  = null;
  var startAt = 0;   // 남은시간을 경과계산으로 다루기 위한 가상 시작시각

  function format(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function expire() {
    var url = new URL(window.location.href);
    url.searchParams.delete('uid');
    window.location.href = url.toString();
  }

  function tick() {
    var remain = LIMIT_MS - (Date.now() - startAt);
    if (remain <= 0) {
      timeEl.textContent = '00:00';
      stop();
      expire();
      return;
    }
    timeEl.textContent = format(remain);
  }

  // 남은시간(remainMs)으로 카운트다운을 (재)시작. 서버값 없으면 풀타임 폴백.
  function render() {
    if (window.__THANKS_EXPIRED__) {
      stop();
      bar.classList.add('is-hidden');
      return;
    }
    var remainMs = (typeof window.__THANKS_REMAIN_MS__ === 'number')
      ? window.__THANKS_REMAIN_MS__
      : LIMIT_MS;
    startAt = Date.now() - (LIMIT_MS - remainMs);
    document.body.classList.add('has-ttl-bar');
    stop();          // 기존 타이머 있으면 정리 후
    tick();          // 즉시 1회
    timer = setInterval(tick, 1000);
  }

  // 최초: resolver 완료를 기다렸다 시작(이미 끝났으면 바로)
  if (window.__THANKS_UID_RESOLVED__) render();
  else document.addEventListener('thanks:uid-resolved', render, { once: true });

  // ★bfcache 복원 재조회 완료 → 최신 남은시간으로 다시 그림
  document.addEventListener('thanks:uid-refreshed', render);
})();
