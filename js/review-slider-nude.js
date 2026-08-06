/* =====================================================================
   review-slider.js — 블록5 후기 슬라이더 (순수 Vanilla, CDN 불필요)
   ---------------------------------------------------------------------
   외부 라이브러리 없음. 이 파일 하나만 복사하면 다른 랜딩에도 그대로 이식.

   [무한 방식 — 재배치 없음]
   원본 카드를 여러 벌 복제해 길게 깔고(REPEAT벌), 가운데 벌에서 시작한다.
   위치는 '칸 index'로만 관리하고 transform = -(index*step).
   좌우로 계속 넘겨 원본 한 바퀴(N칸)를 벗어나면, transition을 끈 채 index를
   N만큼 되돌린다(같은 그림이라 눈에 안 띔). → DOM을 옮기는 재배치가 전혀
   없어 '휘리릭/리셋/앞 카드 없음' 현상이 생기지 않는다. 양방향 무한.

   [동작]
   - 자동: AUTO_GAP초마다 한 칸(왼쪽). 이동 MOVE초, 부드럽게.
   - 드래그: 손가락 따라 이동 → 놓으면 미는 정도만큼 '칸 단위'로 스냅.
   - 손 뗀 뒤 RESUME초가 오롯이 지나야 자동 재개(그 안에 다시 손대면 리셋).

   [HTML 요구] [data-review="viewport"] > [data-review="track"] > .rcard*N
   [OFF] index.html에서 이 <script> 제거.
===================================================================== */
(function () {
  'use strict';

  var viewport = document.querySelector('[data-review="viewport"]');
  var track = document.querySelector('[data-review="track"]');
  if (!viewport || !track) return;

  var originals = Array.prototype.slice.call(track.children);
  var N = originals.length;
  if (N < 1) return;

  // ---- 설정 ----
  var AUTO_GAP = 2000;   // 자동 칸 간격(ms)
  var MOVE     = 900;    // 한 칸 이동 시간(ms)
  var RESUME   = 5000;   // 손 뗀 뒤 자동 재개(ms)
  var EASE     = 'cubic-bezier(.22,.61,.36,1)';
  var REPEAT   = 9;      // 카드 벌 수(홀수 권장, 가운데서 시작)

  // ---- 복제로 길게 깔기 ([원본]×REPEAT) ----
  for (var r = 1; r < REPEAT; r++) {
    originals.forEach(function (node) {
      var c = node.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
  }

  // ---- 상태 ----
  var gap = 0, step = 0;
  var index = N * Math.floor(REPEAT / 2);   // 가운데 벌에서 시작(양쪽에 카드 넉넉)
  var dragBase = 0, dragPx = 0;             // 드래그 중 임시 px
  var autoTimer = 0, resumeTimer = 0;
  var dragging = false, startX = 0, lastX = 0, lastT = 0, vx = 0;

  function measure() {
    gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') || 0;
    var c = track.firstElementChild;
    step = c ? c.offsetWidth + gap : 0;
  }

  function setTransition(on) {
    track.style.transition = on ? ('transform ' + MOVE + 'ms ' + EASE) : 'none';
  }
  function drawIndex() {
    track.style.transform = 'translate3d(' + (-Math.round(index * step)) + 'px,0,0)';
  }
  function drawPx(px) {
    track.style.transform = 'translate3d(' + (-Math.round(px)) + 'px,0,0)';
  }

  // 원본 한 바퀴(N칸) 벗어나면 transition 없이 index를 N배수로 되돌림(순환)
  function wrapIndex() {
    var lo = N, hi = N * (REPEAT - 1);       // 가장자리 벌은 여유로 남겨둠
    if (index < lo || index > hi) {
      setTransition(false);
      // 가운데 벌 대응 위치로: N으로 나눈 나머지 유지하며 가운데로
      var mod = ((index % N) + N) % N;
      index = N * Math.floor(REPEAT / 2) + mod;
      drawIndex();
    }
  }

  /* ---- 자동: 한 칸씩 ---- */
  function stepOnce() {
    setTransition(true);
    index += 1;
    drawIndex();
  }
  track.addEventListener('transitionend', function () {
    wrapIndex();
  });

  function startAuto() { stopAuto(); autoTimer = setInterval(stepOnce, AUTO_GAP + MOVE); }
  function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = 0; } }
  function scheduleResume() { clearTimeout(resumeTimer); resumeTimer = setTimeout(startAuto, RESUME); }
  function cancelResume() { clearTimeout(resumeTimer); }

  /* ---- 포인터 ---- */
  var startY = 0, axisLocked = false, horiz = false;
  function onDown(e) {
    dragging = true;
    axisLocked = false; horiz = false;
    stopAuto(); cancelResume();
    setTransition(false);
    var t = e.touches ? e.touches[0] : e;
    startX = lastX = t.clientX;
    startY = t.clientY;
    dragBase = index * step;
    dragPx = dragBase;
    lastT = performance.now(); vx = 0;
    track.style.cursor = 'grabbing';
  }
  function onMove(e) {
    if (!dragging) return;
    var t = e.touches ? e.touches[0] : e;
    var x = t.clientX, y = t.clientY;

    // 첫 움직임에서 가로/세로 의도 판정(한 번만)
    if (!axisLocked) {
      var dx = Math.abs(x - startX), dy = Math.abs(y - startY);
      if (dx > 6 || dy > 6) {         // 최소 이동 후 판정
        horiz = dx > dy;              // 가로가 더 크면 슬라이드
        axisLocked = true;
      }
    }
    // 세로 의도면 슬라이드 취소하고 브라우저 스크롤에 맡김
    if (axisLocked && !horiz) {
      dragging = false;
      scheduleResume();
      return;
    }
    if (!horiz) return;               // 아직 판정 전엔 대기

    // 가로 슬라이드: 세로 스크롤 차단
    if (e.cancelable) e.preventDefault();
    var now = performance.now(); var dt = now - lastT;
    if (dt > 0) vx = (x - lastX) / dt;
    lastX = x; lastT = now;
    dragPx = dragBase - (x - startX);
    drawPx(dragPx);
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    track.style.cursor = 'grab';
    if (horiz) {
      // 가로 슬라이드였을 때만 스냅. 미는 속도 반영 → 칸 단위 스냅 → index 갱신
      var projected = dragPx + (-vx) * 120;
      index = Math.round(projected / step);
      setTransition(true);
      drawIndex();
    }
    scheduleResume();
  }

  track.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  track.addEventListener('touchstart', onDown, { passive: true });
  track.addEventListener('touchmove', onMove, { passive: false });
  track.addEventListener('touchend', onUp);
  track.style.cursor = 'grab';

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (en.isIntersecting) { if (!dragging) startAuto(); }
      else { stopAuto(); cancelResume(); }
    });
  }, { threshold: 0 });
  io.observe(viewport);

  window.addEventListener('resize', function () { measure(); if (!dragging) { setTransition(false); drawIndex(); } });

  measure();
  setTransition(false);
  drawIndex();
  startAuto();
})();
