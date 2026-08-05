/* =====================================================================
   review-slider.js — 블록5 진단 후기 무한 마퀴 (DOM 재배치 방식, Vanilla)
   ---------------------------------------------------------------------
   [원리 — 복제 없이 무한 루프]
   - 카드 8장만 사용(복제 안 함). 트랙을 translate3d로 왼쪽 이동.
   - 맨 앞 카드가 화면 왼쪽 밖으로 완전히 나가면, 그 카드를 트랙 맨 뒤로
     옮기고(appendChild) offset을 그 카드폭(+gap)만큼 빼서 위치를 보정한다.
     → 눈에는 그대로인데 카드 순서만 8→1 로 돌아, 끊김 없이 무한 순환.
   - 트랙 폭이 절반(8장)이라 모바일 GPU 부담이 크게 준다. gap 유지.

   [부드러움]
   - translate3d + 정수 px(서브픽셀 제거) + GPU 레이어.
   - transform은 값이 바뀐 프레임에만 기록.
   - rAF + 경과시간(dt) 기반 → 프레임 드랍/줌에도 속도 일정.

   [인터랙션]
   - PC hover / 포인터 누름: 정지. 드래그(스와이프): 손가락 따라 이동.
   - 화면 밖이면(IntersectionObserver) 정지.

   [OFF] index.html에서 이 <script> 제거.
===================================================================== */
(function () {
  'use strict';

  var viewport = document.querySelector('[data-review="viewport"]');
  var track = document.querySelector('[data-review="track"]');
  if (!viewport || !track) return;
  if (track.children.length < 2) return;

  var SPEED = 40;        // px/초
  var offset = 0;        // 트랙 이동량(px). 항상 0 이상에서 시작해 커짐
  var gap = 0;
  var paused = false, dragging = false, visible = true;
  var lastX = 0, lastT = 0, lastPx = null, rafId = 0;

  /* gap 측정 (flex gap) */
  function measureGap() {
    var g = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0');
    gap = isNaN(g) ? 0 : g;
  }

  /* 위치 적용 — 정수 px가 바뀐 프레임에만 DOM 기록 */
  function apply() {
    var px = Math.round(offset);
    if (px === lastPx) return;
    lastPx = px;
    track.style.transform = 'translate3d(' + (-px) + 'px,0,0)';
  }

  /* 맨 앞 카드가 완전히 밖으로 나갔으면 뒤로 재배치 + offset 보정 */
  function recycle() {
    // 여러 장이 한 번에 나갈 수도 있으니 while
    var first = track.firstElementChild;
    while (first) {
      var w = first.offsetWidth + gap;   // 카드폭 + gap
      if (offset >= w) {
        track.appendChild(first);        // 맨 뒤로 이동
        offset -= w;                     // 그만큼 빼서 화면 위치 유지(안 튐)
        lastPx = null;                   // 다음 apply 강제 기록
        first = track.firstElementChild;
      } else break;
    }
  }

  /* 애니메이션 루프 */
  function frame(t) {
    if (!lastT) lastT = t;
    var dt = (t - lastT) / 1000;
    lastT = t;
    if (!paused && !dragging && visible) {
      offset += SPEED * dt;
      recycle();
      apply();
    }
    rafId = requestAnimationFrame(frame);
  }

  /* 포인터(드래그/스와이프) */
  function onDown(e) {
    dragging = true;
    lastX = (e.touches ? e.touches[0].clientX : e.clientX);
    track.style.cursor = 'grabbing';
  }
  function onMove(e) {
    if (!dragging) return;
    var x = (e.touches ? e.touches[0].clientX : e.clientX);
    offset += (lastX - x);      // 손가락 방향으로 이동(왼쪽 스와이프 → offset↑)
    lastX = x;
    if (offset < 0) offset = 0; // 음수 방지(뒤로 과도 스와이프 시)
    recycle();
    apply();
  }
  function onUp() {
    dragging = false;
    track.style.cursor = 'grab';
    lastT = 0;
  }

  viewport.addEventListener('mouseenter', function () { paused = true; });
  viewport.addEventListener('mouseleave', function () { paused = false; lastT = 0; });

  track.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  track.addEventListener('touchstart', onDown, { passive: true });
  track.addEventListener('touchmove', onMove, { passive: true });
  track.addEventListener('touchend', onUp);

  track.style.cursor = 'grab';

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { visible = en.isIntersecting; if (visible) lastT = 0; });
  }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
  io.observe(viewport);

  window.addEventListener('resize', measureGap);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureGap);

  measureGap();
  apply();
  rafId = requestAnimationFrame(frame);
})();
