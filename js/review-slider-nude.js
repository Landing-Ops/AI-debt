/* =====================================================================
   review-slider.js — 블록5 진단 후기 가로 스크롤 슬라이더 (Vanilla)
   ---------------------------------------------------------------------
   [역할]
   카드가 가로로 나열된 트랙을 자동으로 흘려보내고, 도트로 위치를 표시.
   오른쪽 끝 카드에 .rcard--peek(반투명)을 붙여 "더 있음"을 암시.

   [동작]
   - scrollTo로 카드 단위 이동(scroll-snap과 병행)
   - 자동재생: 일정 주기로 다음 카드. hover(PC)·터치(모바일) 중 정지
   - 사용자가 직접 스크롤하면 그 위치에 맞춰 도트·peek 갱신
   - 요소 없으면 조용히 종료(섹션을 단계적으로 붙여도 안전)

   [OFF 방법]
   index.html에서 이 <script>만 제거. 트랙은 그대로 수동 스크롤됨.
===================================================================== */
(function () {
  'use strict';

  var track = document.querySelector('[data-review="track"]');
  var dotsWrap = document.querySelector('[data-review="dots"]');
  if (!track) return;

  var cards = Array.prototype.slice.call(track.children);
  var dots  = dotsWrap ? Array.prototype.slice.call(dotsWrap.children) : [];
  if (cards.length < 2) return;

  var DURATION = 3500;
  var index = 0;
  var timer = null;
  var isPaused = false;

  /* ---------- 현재 스크롤 위치로 활성 인덱스 계산 ---------- */
  function nearestIndex() {
    var left = track.scrollLeft;
    var best = 0, bestDist = Infinity;
    cards.forEach(function (c, i) {
      var d = Math.abs(c.offsetLeft - track.offsetLeft - left);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  /* ---------- 도트 + peek(반투명) 상태 갱신 ---------- */
  function paint(i) {
    dots.forEach(function (d, di) {
      d.setAttribute('aria-selected', di === i ? 'true' : 'false');
    });
    // 마지막으로 완전히 보이는 카드의 "다음" 카드에만 peek 적용
    cards.forEach(function (c, ci) {
      c.classList.toggle('rcard--peek', ci === i + 2);
    });
  }

  function goTo(i) {
    index = (i + cards.length) % cards.length;
    var target = cards[index];
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    paint(index);
  }

  /* ---------- 자동재생 ---------- */
  function tick()  { if (!isPaused) goTo(index + 1); }
  function start() { stop(); timer = setInterval(tick, DURATION); }
  function stop()  { if (timer) clearInterval(timer); }

  /* ---------- 사용자 직접 스크롤 → 인덱스 동기화 ---------- */
  var scrollRaf = 0;
  track.addEventListener('scroll', function () {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(function () {
      index = nearestIndex();
      paint(index);
    });
  }, { passive: true });

  /* ---------- hover(PC) / 터치(모바일) 중 정지 ---------- */
  track.addEventListener('mouseenter', function () { isPaused = true; });
  track.addEventListener('mouseleave', function () { isPaused = false; });
  track.addEventListener('touchstart', function () { isPaused = true; }, { passive: true });
  track.addEventListener('touchend',   function () { isPaused = false; }, { passive: true });

  /* ---------- 도트 클릭 ---------- */
  dots.forEach(function (d, di) {
    d.style.cursor = 'pointer';
    d.addEventListener('click', function () { goTo(di); start(); });
  });

  /* ---------- 화면에 보일 때만 자동재생 시작 ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { start(); } else { stop(); }
    });
  }, { threshold: 0.3 });
  io.observe(track);

  paint(0);
})();
