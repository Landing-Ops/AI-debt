/* =====================================================================
   form.js — 입력폼 페이지 연출 제어
   1) 오버레이 3개 순차 노출(각 2~2.4초) → fade-out → 본문 노출
   2) 본문 노출 직후 게이지 0 → 70% 차오름(미완성 연출)
   3) 후기 8개 렌더(정밀 진단으로 탕감율 올린 서사)
   ※ 폼 입력·OTP·전송은 lead-form.js가 담당(이 파일은 연출만).
===================================================================== */
(function () {
  'use strict';

  var root    = document.querySelector('[data-fm="root"]');
  var overlay = document.querySelector('[data-fm="overlay"]');
  var stepEl  = document.querySelector('[data-fm="ov-step"]');
  if (!root || !overlay || !stepEl) return;

  /* ---------- 오버레이 3단계 문구 ---------- */
  var STEPS = [
    '2026년 최신 개인회생 기준으로 분석 중...',
    '입력하신 소득·채무·지역을 반영하고 있어요...',
    '기본 탕감율 산출 완료. 정밀 항목을 확인하세요...'
  ];
  var STEP_MS = 2000;    // 각 단계 노출 시간
  var GAUGE_TARGET = 70; // 게이지 목표(%)

  /* 진단 답변이 아예 없으면(직접 진입) 진단으로 돌려보냄 — 선택적 가드 */
  // (라우팅 정책 확정 후 활성화)
  // try { if (!sessionStorage.getItem('q_debt')) location.replace('./diagnosis.html'); } catch(e){}

  var idx = 0;
  function showStep(i) {
    stepEl.classList.add('ov__step--swap');
    setTimeout(function () {
      stepEl.textContent = STEPS[i];
      stepEl.classList.remove('ov__step--swap');
    }, 180);
  }

  function nextStep() {
    idx++;
    if (idx < STEPS.length) {
      showStep(idx);
      setTimeout(nextStep, STEP_MS);
    } else {
      setTimeout(endOverlay, STEP_MS);
    }
  }

  function endOverlay() {
    overlay.classList.add('ov--out');
    setTimeout(function () {
      overlay.setAttribute('hidden', '');
      root.removeAttribute('hidden');
      revealBody();
    }, 500);
  }

  function revealBody() {
    // 게이지 0 → 70% 차오름
    var fill = document.querySelector('[data-fm="gauge-fill"]');
    var pct  = document.querySelector('[data-fm="gauge-pct"]');
    if (fill && pct) {
      // 다음 프레임에 width 적용해야 트랜지션이 걸림
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          fill.style.width = GAUGE_TARGET + '%';
        });
      });
      // 숫자 카운트업 0 → 70
      var start = null, dur = 1100;
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        pct.textContent = Math.round(p * GAUGE_TARGET) + '%';
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    renderReviews();
  }

  /* ---------- 후기 8개 (정밀 진단으로 탕감율 올린 서사 — 임시 데이터) ----------
     ★실제 후기 원본 확보 후 이 배열만 교체. delta=상승폭 뱃지. */
  var REVIEWS = [
    { who: '김OO', meta: '40대 · 서울',   before: 72, after: 91, quote: '처음엔 70%대로 봤는데, 정밀 진단으로 항목을 더 반영하니 훨씬 높게 나왔어요.' },
    { who: '이OO', meta: '30대 · 경기',   before: 68, after: 89, quote: '기본 계산만 보고 반신반의했는데, 자세히 볼수록 탕감율이 올라가더라고요.' },
    { who: '박OO', meta: '50대 · 부산',   before: 80, after: 95, quote: '제 상황에 맞는 감면 제도까지 반영되니 생각보다 많이 줄었습니다.' },
    { who: '정OO', meta: '40대 · 인천',   before: 65, after: 88, quote: '혼자 알아볼 땐 몰랐던 부분까지 반영돼서 결과가 달라졌어요.' },
    { who: '최OO', meta: '30대 · 대구',   before: 74, after: 92, quote: '정확한 제 탕감율을 확인하고 나서야 마음이 놓였습니다.' },
    { who: '강OO', meta: '40대 · 광주',   before: 70, after: 90, quote: '기본값이랑 실제 인정 탕감율 차이가 이렇게 큰 줄 몰랐어요.' },
    { who: '윤OO', meta: '50대 · 대전',   before: 78, after: 94, quote: '남은 정밀 항목까지 반영하니 제 상황에 딱 맞는 결과가 나왔어요.' },
    { who: '임OO', meta: '30대 · 울산',   before: 66, after: 87, quote: '자세히 들여다볼수록 탕감율이 올라간다는 게 사실이었네요.' }
  ];

  function renderReviews() {
    var list = document.querySelector('[data-fm="revs-list"]');
    if (!list) return;
    var html = REVIEWS.map(function (r) {
      return '' +
        '<div class="fmrev">' +
          '<div class="fmrev__top">' +
            '<span class="fmrev__who">' + r.who + ' <span>' + r.meta + '</span></span>' +
            '<span class="fmrev__delta"><i class="ti ti-trending-up" aria-hidden="true"></i>' +
              r.before + '% → ' + r.after + '%</span>' +
          '</div>' +
          '<p class="fmrev__quote">' + r.quote + '</p>' +
        '</div>';
    }).join('');
    list.innerHTML = html;
  }

  /* ---------- 시작 ---------- */
  // 첫 단계는 이미 HTML에 박혀 있음 → STEP_MS 후 2번째로
  overlay.removeAttribute('hidden');
  setTimeout(nextStep, STEP_MS);
})();
