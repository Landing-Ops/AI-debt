/* =====================================================================
   review-slider.js — 블록5 후기 (Swiper, 안정 무한 루프)
   ---------------------------------------------------------------------
   [왜 이렇게] slidesPerView:'auto'는 loop과 상성이 나빠 드래그가 튀고
   끝에서 안 이어진다. 그래서 slidesPerView를 '숫자'로 준다(loop 복제가
   정확히 계산됨). 카드 폭을 320px로 유지하려고, 화면폭÷320 을 계산해
   소수점 slidesPerView로 넣고 리사이즈 때 갱신한다.

   speed 4200 + autoplay delay:0 + linear → 거의 연속처럼 흐름.
   loop 무한, 드래그 허용. 군더더기 옵션 없음.

   ※ Swiper CDN 필요. [OFF] index.html에서 <script>+CDN 제거.
===================================================================== */
(function () {
  'use strict';
  if (typeof Swiper === 'undefined') return;
  var el = document.querySelector('[data-review="viewport"].swiper');
  if (!el) return;

  // 후기 8장은 PC에서 loop 복제가 부족해 '끝이 나는' 문제가 생긴다.
  // 초기화 전에 슬라이드를 한 벌 복제해 16장으로 만들어 loop을 넉넉하게 한다.
  var wrapEl = el.querySelector('.swiper-wrapper');
  if (wrapEl && wrapEl.children.length <= 8) {
    var slides = Array.prototype.slice.call(wrapEl.children);
    slides.forEach(function (s) {
      var c = s.cloneNode(true);
      c.removeAttribute('data-review');
      wrapEl.appendChild(c);
    });
  }

  var CARD = 320 + 16;   // 카드 폭 + spaceBetween

  function spv() {
    // 화면(컨테이너) 폭에 카드가 몇 장 들어가는지 → 소수점 그대로
    var w = el.clientWidth || window.innerWidth;
    return Math.max(1.1, w / CARD);
  }

  var sw = new Swiper(el, {
    slidesPerView: spv(),          // 숫자(소수점) → loop 안정
    spaceBetween: 16,
    loop: true,
    loopAdditionalSlides: 3,       // 16장이면 3으로 충분(복제 과다 = 무거움)
    speed: 4200,
    allowTouchMove: true,
    autoplay: {
      delay: 0,
      disableOnInteraction: false,
    },
  });

  // 드래그 중엔 자동 흐름 정지, 놓으면 살짝 텀 두고 재개.
  // (즉시 재개하면 자동 이동이 드래그에 이어붙어 '홱 몇 px 더 감')
  var resumeTimer = 0;
  sw.on('touchStart', function () {
    clearTimeout(resumeTimer);
    sw.autoplay.stop();
  });
  sw.on('touchEnd', function () {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(function () { sw.autoplay.start(); }, 350);
  });

  // 리사이즈 시 slidesPerView 갱신(카드 폭 유지)
  window.addEventListener('resize', function () {
    sw.params.slidesPerView = spv();
    sw.update();
  });

  // 각 전환 등속(linear) + GPU 레이어 힌트 → 감속·미세 버벅 완화
  var wrap = el.querySelector('.swiper-wrapper');
  function linearize(){
    if (wrap) {
      wrap.style.transitionTimingFunction = 'linear';
      wrap.style.willChange = 'transform';
    }
  }
  linearize();
  sw.on('setTransition', linearize);
})();