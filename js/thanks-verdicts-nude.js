/* =====================================================================
   thanks-verdicts.js — 섹션4 면책 결정문 무한 자동 마퀴
   - 원본 슬라이드를 그대로 1벌 복제해 트랙에 이어붙임 (끊김 없는 루프)
   - 원본 1세트의 실제 폭을 재서 CSS 변수(--vd-shift)로 넘김
     → 화면폭/이미지 로드에 따라 이동거리가 어긋나지 않음
===================================================================== */
(function () {
  'use strict';

  var track = document.querySelector('[data-vd-track]');
  if (!track) return;

  var originals = Array.prototype.slice.call(track.children);
  if (!originals.length) return;

  // 1) 원본을 1벌 복제해서 뒤에 이어붙임 (aria-hidden 처리)
  originals.forEach(function (li) {
    var clone = li.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });

  // 2) 원본 1세트의 폭(마지막 원본 오른쪽 끝 - 첫 원본 왼쪽 끝 + gap)을 재서 이동거리로 설정
  function setShift() {
    var styles = getComputedStyle(track);
    var gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    var setWidth = 0;
    originals.forEach(function (li) {
      setWidth += li.getBoundingClientRect().width + gap;
    });
    track.style.setProperty('--vd-shift', setWidth + 'px');
  }

  // 이미지가 로드되면 폭이 확정되므로, 로드 후/리사이즈 시 재계산
  function schedule() { requestAnimationFrame(setShift); }

  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);

  schedule(); // 즉시 1회 (캐시된 경우 대비)
})();