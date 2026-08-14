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
  var steps   = Array.prototype.slice.call(document.querySelectorAll('[data-fm="ov-step"]'));
  if (!root || !overlay || !steps.length) return;

  var STEP_MS = 1500;    // 각 단계 진행 시간
  var GAUGE_TARGET = 70; // 게이지 목표(%)

  /* 진단 답변이 아예 없으면(직접 진입) 진단으로 돌려보냄 — 선택적 가드 */
  // try { if (!sessionStorage.getItem('q_debt')) location.replace('./diagnosis.html'); } catch(e){}

  /* ---------- 오버레이: 체크리스트 3단계 순차 (doing → done) ---------- */
  var idx = 0;
  function advance() {
    // 현재 단계를 done 처리
    if (steps[idx]) {
      steps[idx].classList.remove('loading__step--doing');
      steps[idx].classList.add('loading__step--done');
    }
    idx++;
    if (idx < steps.length) {
      // 다음 단계 doing
      steps[idx].classList.remove('loading__step--wait');
      steps[idx].classList.add('loading__step--doing');
      setTimeout(advance, STEP_MS);
    } else {
      // 전부 완료 → 잠깐 뒤 오버레이 종료
      setTimeout(endOverlay, 600);
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

  /* ---------- 후기 8개 (정밀 진단으로 탕감율 올린 서사) ----------
     원본 사연 기반 재가공: 브랜드명 제거 + '기본 진단→정밀 진단 후 탕감율 상승' 구조.
     job=직업칩, pay=매달 갚는 금액, before=기본 예상, after=정밀 후 실제. */
  var REVIEWS = [
    { who: '김XX님', meta: '서울', job: '직장인', pay: '월 11만원', before: 78, after: 91,
      quote: '허리디스크로 몇 달 일을 못 하며 빚이 4천3백만원까지 늘었어요. 기본 진단만 봤을 땐 이 정도인가 했는데, 정밀 항목까지 반영하니 탕감율이 훨씬 올라가 지금은 매달 11만원 정도만 갚고 있습니다.' },
    { who: '박XX님', meta: '부산', job: '일용직', pay: '월 30만원', before: 80, after: 95,
      quote: '막노동·대리운전을 병행하며 애 둘을 혼자 키우다 빚이 2억을 넘겼습니다. 처음 예상보다 정밀 진단에서 제 사정이 더 반영돼, 지금은 한 달 30만원 정도만 갚으며 살고 있어요.' },
    { who: '이XX님', meta: '대구', job: '프리랜서', pay: '월 21만원', before: 74, after: 87,
      quote: '남편 사고로 수입이 끊기며 빚이 5천8백만원까지 늘었어요. 기본 계산으론 반신반의했는데, 정밀하게 들여다보니 탕감율이 더 나와 매달 21만원씩 갚으며 다시 시작하고 있습니다.' },
    { who: '정XX님', meta: '경기 수원', job: '자영업', pay: '월 34만원', before: 79, after: 92,
      quote: '작은 김밥집이 도로공사로 빚이 1억 7천만원까지 늘었습니다. 재산을 다 뺏길까 겁났는데, 정밀 진단으로 제 상황에 맞는 감면까지 반영돼 살던 집을 지키며 한 달 34만원씩 갚고 있어요.' },
    { who: '최XX님', meta: '인천', job: '사업자', pay: '월 54만원', before: 82, after: 95,
      quote: '공장이 부도나며 빚이 4억 2천만원까지 늘고 아버지 병간호까지 겹쳤습니다. 혼자 계산할 땐 막막했는데, 정밀 항목까지 반영하니 원금 95%를 덜어 매달 54만원 정도만 갚습니다.' },
    { who: '한XX님', meta: '광주', job: '주식·코인', pay: '월 164만원', before: 74, after: 86,
      quote: '투자 실패로 빚이 4억 2천만원까지 불었어요. 기본 예상보다 정밀 진단에서 더 정확한 탕감율이 나와, 지금은 매월 164만원씩 갚으며 원금 86%를 덜었습니다.' },
    { who: '윤XX님', meta: '제주', job: '기타', pay: '월 43만원', before: 70, after: 82,
      quote: '빚이 8천4백만원까지 늘어 매일 조마조마했습니다. 정밀 진단으로 제 형편이 자세히 반영되며 예상보다 탕감율이 올라가, 지금은 43만원씩 갚으며 원금 82%를 덜었어요.' },
    { who: '장XX님', meta: '경기 안산', job: '사기피해', pay: '월 63만원', before: 81, after: 94,
      quote: '리딩방 사기로 빚이 3억 9천만원까지 늘어 억울했습니다. 정밀 진단에서 제게 맞는 항목까지 반영돼 원금 94%를 덜었고, 지금은 63만원 정도만 갚으며 제자리를 찾고 있어요.' }
  ];

  function renderReviews() {
    var list = document.querySelector('[data-fm="revs-list"]');
    if (!list) return;
    var html = REVIEWS.map(function (r) {
      return '' +
        '<div class="fmrev">' +
          '<div class="fmrev__top">' +
            '<span class="fmrev__who"><span class="fmrev__job">' + r.job + '</span>' + r.who + ' · ' + r.meta + '</span>' +
            '<span class="fmrev__delta"><i class="ti ti-trending-up" aria-hidden="true"></i>' +
              r.before + '% → <b>' + r.after + '%</b></span>' +
          '</div>' +
          '<p class="fmrev__quote">' + r.quote + '</p>' +
          '<div class="fmrev__foot"><span class="fmrev__pay-l">현재 상환</span><span class="fmrev__pay-v">' + r.pay + '</span></div>' +
        '</div>';
    }).join('');
    list.innerHTML = html;
  }

  /* ---------- 시작 ---------- */
  overlay.removeAttribute('hidden');
  setTimeout(advance, STEP_MS);

  /* ---------- 개인정보 약관 팝업 여닫기 (result.js에서 이식) ---------- */
  var terms   = document.querySelector('[data-rz="lead-terms"]');
  var privacy = document.querySelector('[data-rz="privacy-modal"]');
  if (terms && privacy) {
    terms.addEventListener('click', function (e) {
      e.preventDefault();
      privacy.hidden = false;
      var pbody = privacy.querySelector('.privacy__body');
      if (pbody) pbody.scrollTop = 0;
    });
    privacy.querySelectorAll('[data-rz="privacy-close"]').forEach(function (el) {
      el.addEventListener('click', function () { privacy.hidden = true; });
    });
  }
})();
