/* =====================================================================
   review-slider.js — 블록5 진단 후기 무한 마퀴 (transform 기반, Vanilla)
   ---------------------------------------------------------------------
   [역할]
   후기 카드를 왼쪽으로 끊김 없이 흘려보낸다(marquee). 8장 뒤 1장이
   자연스럽게 이어지고, 브라우저 확대/축소·어떤 폭에서도 이음매가 없다.

   [원리]
   - 트랙(원본 카드 세트)을 통째로 1벌 복제해 [원본][복제]로 만든다.
   - translateX(-offset)로 매 프레임 왼쪽 이동. offset이 '원본 1벌 폭'에
     도달하면 offset을 그만큼 빼서 0 근처로 되돌린다(순간 점프이나 복제본이
     같은 그림이라 눈에 안 띔) → 무한 루프.
   - requestAnimationFrame + 경과시간(dt) 기반이라 프레임 드랍/줌에도 속도 일정.

   [인터랙션]
   - PC hover / 포인터 누름: 자동 흐름 정지
   - 포인터 드래그(스와이프): 손가락 따라 좌우로 밀림. 놓으면 자동 재개.
   - 화면에서 벗어나면(IntersectionObserver) 애니메이션 정지(성능).

   [OFF] index.html에서 이 <script> 제거.
===================================================================== */
(function () {
  'use strict';

  var viewport = document.querySelector('[data-review="viewport"]');
  var track = document.querySelector('[data-review="track"]');
  if (!viewport || !track) return;

  var originals = Array.prototype.slice.call(track.children);
  if (originals.length < 2) return;

  var SPEED = 40;            // px/초 — 흐르는 속도(보통). 낮추면 느려짐
  var offset = 0;           // 현재 이동량(px)
  var setWidth = 0;         // 원본 1벌 폭(복제 경계)
  var paused = false;       // hover/포인터로 정지
  var dragging = false;
  var lastX = 0;
  var rafId = 0;
  var lastT = 0;
  var visible = true;

  /* ---------- 복제: [원본][복제] 2벌 ---------- */
  originals.forEach(function (node) {
    var clone = node.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });

  /* ---------- 원본 1벌 폭 측정 (gap 포함) ---------- */
  function measure() {
    // 원본 첫 카드 left ~ 복제 첫 카드 left 사이 거리 = 원본 1벌 폭(+gap)
    var firstClone = track.children[originals.length];
    if (firstClone) {
      setWidth = firstClone.offsetLeft - track.children[0].offsetLeft;
    } else {
      setWidth = track.scrollWidth / 2;
    }
  }

  /* ---------- 위치 적용 ---------- */
  function apply() {
    // offset 정규화: [0, setWidth) 범위로 랩
    if (setWidth > 0) {
      while (offset >= setWidth) offset -= setWidth;
      while (offset < 0) offset += setWidth;
    }
    track.style.transform = 'translateX(' + (-offset) + 'px)';
  }

  /* ---------- 애니메이션 루프 ---------- */
  function frame(t) {
    if (!lastT) lastT = t;
    var dt = (t - lastT) / 1000;   // 초 단위 경과
    lastT = t;
    if (!paused && !dragging && visible) {
      offset += SPEED * dt;
      apply();
    }
    rafId = requestAnimationFrame(frame);
  }

  /* ---------- 포인터(드래그/스와이프) ---------- */
  function onDown(e) {
    dragging = true;
    lastX = (e.touches ? e.touches[0].clientX : e.clientX);
    track.style.cursor = 'grabbing';
  }
  function onMove(e) {
    if (!dragging) return;
    var x = (e.touches ? e.touches[0].clientX : e.clientX);
    var dx = x - lastX;
    lastX = x;
    offset -= dx;              // 손가락 방향으로 이동
    apply();
  }
  function onUp() {
    dragging = false;
    track.style.cursor = 'grab';
    lastT = 0;                 // dt 튀는 것 방지
  }

  /* hover 정지(PC) */
  viewport.addEventListener('mouseenter', function () { paused = true; });
  viewport.addEventListener('mouseleave', function () { paused = false; lastT = 0; });

  /* 포인터 다운/무브/업 */
  track.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  track.addEventListener('touchstart', onDown, { passive: true });
  track.addEventListener('touchmove', onMove, { passive: true });
  track.addEventListener('touchend', onUp);

  track.style.cursor = 'grab';
  track.style.willChange = 'transform';

  /* 화면 밖이면 정지(성능) */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { visible = en.isIntersecting; if (visible) lastT = 0; });
  }, { threshold: 0 });
  io.observe(viewport);

  /* 리사이즈/폰트로드 시 재측정 */
  window.addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  measure();
  apply();
  rafId = requestAnimationFrame(frame);
})();
