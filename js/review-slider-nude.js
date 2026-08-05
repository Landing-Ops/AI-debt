/* =====================================================================
   review-slider.js — 블록5 후기 (Swiper 순정 슬라이드쇼)
   ---------------------------------------------------------------------
   수동 translate 조작 없이 Swiper 기본 기능만 사용 → loop/드래그/무한이
   서로 충돌하지 않고 안정적으로 동작.
   - autoplay로 한 칸씩 부드럽게 자동 이동(경쟁사와 동일 방식).
   - loop 무한. 드래그(스와이프)로 넘기기. 마우스 올려도 계속 진행.

   ※ Swiper CDN(js/css)은 index <head>/하단에서 로드됨.
   [OFF] index.html에서 이 <script>와 Swiper CDN 두 줄 제거.
   [속도조절]
     - speed  : 한 칸 넘어가는 이동 시간(ms). 클수록 부드럽고 느긋.
     - delay  : 한 칸 후 다음까지 쉬는 시간(ms). 작을수록 자주 넘어감.
===================================================================== */
(function () {
  'use strict';
  if (typeof Swiper === 'undefined') return;
  var el = document.querySelector('[data-review="viewport"].swiper');
  if (!el) return;

  var sw = new Swiper(el, {
    slidesPerView: 'auto',
    spaceBetween: 50,
    loop: true,
    grabCursor: true,
    allowTouchMove: true,     // 드래그/스와이프로 넘기기
    speed: 8000,              // 한 칸 이동을 길게 → 멈칫 지점 간격이 멀어져 거의 연속
    autoplay: {
      delay: 0,               // 쉬는 틈 없음
      disableOnInteraction: false,  // 드래그 후에도 자동 재개
      pauseOnMouseEnter: false,     // 마우스 올려도 안 멈춤
    },
  });

  // 각 칸 이동을 등속(linear)으로 → 가속/감속 없이 매끄럽게(멈칫 느낌 최소화)
  var wrap = el.querySelector('.swiper-wrapper');
  function linearize(){ if (wrap) wrap.style.transitionTimingFunction = 'linear'; }
  linearize();
  sw.on('setTransition', linearize);
})();