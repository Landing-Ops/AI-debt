/* =====================================================================
   thanks-tracking.js — 땡큐페이지 체류·스크롤 트래킹
   - resolver(thanks-uid-resolver.js)가 uid를 정상 판정한 뒤에만 시작
     · 만료/미존재(__THANKS_EXPIRED__)면 추적 안 함
     · thanks:uid-resolved 이벤트를 기다렸다 boot() (countdown.js와 동일 패턴)
   - 최대 스크롤 도달률(%, max) + 활성 체류시간(초, 탭 숨김 구간 제외, 누적)
   - sendBeacon 으로 15초 주기 + 탭 hidden + pagehide 시점에 스냅샷 전송
   - 체류는 델타(증가분)로 전송 → 웹앱3가 += 누적, 스크롤은 max upsert
===================================================================== */
(function () {
  'use strict';

  var TRACK_URL = 'https://ai-debt.softman007.workers.dev/track'; // 5단계: Workers /track → D1 (GAS 웹앱3 대체)
  var SEND_INTERVAL_MS = 15000;  // 앱스서버로 15초마다 데이터값을 보내주는 주기

  /* ---------- uid 파싱 (resolver와 동일) ---------- */
  var params = new URLSearchParams(window.location.search);
  var uid = (params.get('uid') || '').trim();
  if (!uid) return;   // uid 없으면 추적 안 함

/* ---------- resolver 동기화: 정상 판정된 유저만 추적 ---------- */
  var started = false;
  function ready() {
    if (started) return;
    if (window.__THANKS_EXPIRED__) return;   // 만료/미존재 → 추적 안 함
    started = true;
    boot();
  }
  document.addEventListener('thanks:uid-resolved', ready, { once: true });
  if (window.__THANKS_UID_RESOLVED__) ready();      // 이미 지나간 경우
  setTimeout(function () {                            // 안전 폴백
    if (!started && !window.__THANKS_EXPIRED__) ready();
  }, 2000);


  /* =====================================================================
     boot — 실제 추적 시작 (여기서부터 시간·스크롤 측정)
  ===================================================================== */
  function boot() {
    /* ---------- 상태 ---------- */
    var maxScroll = 0;
    var activeMs  = 0;
    var sentMs    = 0;          // 지금까지 서버로 보낸 체류 누계 (델타 계산용)
    var lastTick  = Date.now();
    var isVisible = (document.visibilityState === 'visible');

    /* ---------- 활성 체류시간: 보이는 동안만 누적 ---------- */
    function accumulate() {
      var now = Date.now();
      if (isVisible) activeMs += (now - lastTick);
      lastTick = now;
    }

    /* ---------- 스크롤 도달률 계산 ---------- */
    function measureScroll() {
      var doc = document.documentElement;
      var body = document.body;
      var scrollTop = window.pageYOffset || doc.scrollTop || 0;
      var winH = window.innerHeight || doc.clientHeight || 0;
      var docH = Math.max(
        body.scrollHeight, doc.scrollHeight,
        body.offsetHeight, doc.offsetHeight,
        body.clientHeight, doc.clientHeight
      );
      var scrollable = docH - winH;
      var pct = scrollable <= 0 ? 100 : ((scrollTop + winH) / docH) * 100;
      if (pct > 100) pct = 100;
      if (pct > maxScroll) maxScroll = pct;
    }

    var scrollScheduled = false;
    window.addEventListener('scroll', function () {
      if (scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(function () {
        measureScroll();
        scrollScheduled = false;
      });
    }, { passive: true });

    measureScroll();   // 진입 시 1회

    /* ---------- 전송 (체류는 델타, 스크롤은 현재 최댓값) ---------- */
    function send() {
      accumulate();
      var totalSec = Math.round(activeMs / 1000);
      var deltaSec = totalSec - sentMs;
      if (deltaSec < 0) deltaSec = 0;

      var payload = JSON.stringify({
        uid: uid,
        scroll: Math.round(maxScroll),
        dwellDelta: deltaSec
      });

      var ok = false;
      try {
        var blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
        ok = navigator.sendBeacon(TRACK_URL, blob);
      } catch (err) { ok = false; }

      if (!ok) {
        fetch(TRACK_URL, { method: 'POST', mode: 'no-cors', body: payload,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, keepalive: true
        }).catch(function () {});
      }

      sentMs = totalSec;   // 보낸 만큼 커밋
    }

    /* ---------- 주기 전송 ---------- */
    var timer = setInterval(send, SEND_INTERVAL_MS);

    /* ---------- 탭 가시성 변화 ---------- */
    document.addEventListener('visibilitychange', function () {
      accumulate();
      isVisible = (document.visibilityState === 'visible');
      lastTick = Date.now();
      if (!isVisible) send();   // 숨겨질 때 스냅샷 (모바일 이탈 대응)
    });

    /* ---------- 페이지 이탈 ---------- */
    window.addEventListener('pagehide', function () {
      clearInterval(timer);
      send();
    });
    window.addEventListener('beforeunload', send);   // 보조
  }
})();