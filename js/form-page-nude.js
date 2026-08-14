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
    initReviewCarousel();
  }

  /* ---------- 후기 8개 (정밀 진단 전→후 탕감율 상승 서사) ----------
     원본 사연 기반 재가공: 브랜드명 제거 + '다른 데선 낮게 봤는데 정밀 진단하니 더 올랐다'.
     job=직업칩, debt=채무, pay=월상환, before=정밀 전 탕감율, after=정밀 후 탕감율, img=사진. */
  var REVIEWS = [
    { who:'김XX님', region:'서울', debt:'5,000만원', pay:'월 13만원', before:71, after:91, img:'./img/ts_1.png',
      quote:'코로나로 가게 매출이 반토막 나며 카드빚이 5천만원까지 불었어요. 다른 곳에선 71% 정도라고 들었는데, 여기서 정밀 진단을 받아보니 91%까지 나왔습니다. 지금은 매달 13만원 정도만 갚고 있어요.' },
    { who:'박XX님', region:'부산', debt:'1억 8천만원', pay:'월 28만원', before:79, after:95, img:'./img/ts_2.png',
      quote:'전세 사기를 당하고 대출 이자까지 겹쳐 빚이 1억 8천만원을 넘겼습니다. 처음 알아본 79%에서 접으려 했는데, 정밀 진단에서 제 형편이 반영되니 95%까지 올라갔어요. 지금은 한 달 28만원 정도만 갚습니다.' },
    { who:'이XX님', region:'대구', debt:'6,000만원', pay:'월 19만원', before:66, after:87, img:'./img/ts_3.png',
      quote:'부모님 병원비를 카드 돌려막기로 버티다 빚이 6천만원까지 늘었어요. 66%라던 예상을 반신반의했는데, 정밀 진단 결과 87%가 나와 그제야 마음을 놓았습니다. 매달 19만원씩 갚으며 버티고 있어요.' },
    { who:'정XX님', region:'경기 수원', debt:'1억 4천만원', pay:'월 31만원', before:74, after:92, img:'./img/ts_4.png',
      quote:'온라인 쇼핑몰 재고를 떠안으며 빚이 1억 4천만원까지 늘었습니다. 부양가족과 생활 여건까지 정밀하게 반영되니, 처음 74%에서 92%로 껑충 뛰었어요. 지금은 한 달 31만원씩 갚고 있습니다.' },
    { who:'최XX님', region:'인천', debt:'3억 9천만원', pay:'월 49만원', before:80, after:95, img:'./img/ts_5.png',
      quote:'동업자에게 사업 빚을 떠안고 잠적당해 4억 가까이 빚이 남았습니다. 혼자 계산한 80%에서 놓쳤던 항목까지 정밀 진단이 잡아주니 95%가 나왔어요. 지금은 매달 49만원 정도만 갚습니다.' },
    { who:'한XX님', region:'광주', debt:'3억 8천만원', pay:'월 148만원', before:69, after:88, img:'./img/ts_6.png',
      quote:'무리한 부동산 대출이 금리 인상으로 감당이 안 돼 빚이 3억 8천만원까지 불었어요. 기본 예상 69%랑 정밀 진단 결과가 이렇게 차이 날 줄 몰랐습니다. 88%까지 오를 줄은요. 지금은 매월 148만원씩 갚고 있어요.' },
    { who:'윤XX님', region:'제주', debt:'7,500만원', pay:'월 38만원', before:72, after:87, img:'./img/ts_7.png',
      quote:'실직 후 생활비를 카드로 메우다 빚이 7천5백만원까지 늘어 매일 조마조마했습니다. 72%면 많이 받는 거라 생각했는데, 정밀 진단에서 제 형편이 반영되니 예상보다 높은 87%가 나와 놀랐어요. 지금은 38만원씩 갚습니다.' },
    { who:'장XX님', region:'경기 안산', debt:'3억 5천만원', pay:'월 58만원', before:73, after:94, img:'./img/ts_8.png',
      quote:'보증을 잘못 서 남의 빚까지 3억 5천만원을 떠안았습니다. 자세히 볼수록 탕감율이 오른다는 게 사실이더라고요. 73%였던 예상이 정밀 진단 후 94%가 됐어요. 지금은 58만원 정도만 갚으며 제자리를 찾고 있습니다.' }
  ];

  function renderReviews() {
    var track = document.querySelector('[data-fm="revs-track"]');
    var dots  = document.querySelector('[data-fm="revs-dots"]');
    if (!track) return;
    track.innerHTML = REVIEWS.map(function (r, i) {
      // 그래프: 정밀 전(before) → 정밀 후(after). 막대 높이는 탕감율에 비례.
      return '' +
        '<li class="ts__slide" id="fmv-slide-' + (i+1) + '">' +
          '<div class="ts__grid">' +
            '<div class="ts__copy">' +
              '<div class="ts__headline"><span class="ts__name">' + r.who + ' <em>' + r.region + '</em></span></div>' +
              '<blockquote class="ts__quote">' + r.quote + '</blockquote>' +
            '</div>' +
            '<div class="ts__chartWrap">' +
              '<div class="ts__chartHead"><span>정밀 진단 후</span><b>탕감율 ' + r.after + '%</b><em>+' + (r.after - r.before) + '%p</em></div>' +
              '<div class="ts__miniChart" aria-hidden="true" data-before="' + (r.before/100) + '" data-after="' + (r.after/100) + '">' +
                '<div class="ts__bar ts__bar--before"><em class="ts__barval">' + r.before + '%</em><span>정밀 전</span></div>' +
                '<div class="ts__bar ts__bar--after"><em class="ts__barval">' + r.after + '%</em><span>정밀 후</span></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</li>';
    }).join('');
    if (dots) {
      dots.innerHTML = REVIEWS.map(function (r, i) {
        return '<button class="ts__dot" role="tab" aria-selected="' + (i===0?'true':'false') + '" aria-controls="fmv-slide-' + (i+1) + '"><span class="sr-only">' + (i+1) + '번 후기</span></button>';
      }).join('');
    }
  }

  /* ---------- 후기 슬라이드 캐러셀 (원본 carousel.js 이식) ---------- */
  function initReviewCarousel() {
    var root = document.querySelector('.fmv .ts');
    if (!root) return;
    var track  = root.querySelector('.ts__track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.ts__slide'));
    var prevBtn= root.querySelector('.ts__nav--prev');
    var nextBtn= root.querySelector('.ts__nav--next');
    var dots   = Array.prototype.slice.call(document.querySelectorAll('.fmv .ts__dot'));
    if (!track || !slides.length) return;

    var index = 0, DURATION = 6000, timer = null, isPaused = false;

    // 그래프 막대 애니메이션
    function usableHeight(chartEl){
      var cs = getComputedStyle(chartEl);
      return Math.max(0, chartEl.clientHeight - (parseFloat(cs.paddingTop)||0) - (parseFloat(cs.paddingBottom)||0));
    }
    function setBars(slide){
      var chart = slide.querySelector('.ts__miniChart'); if(!chart) return;
      var useH = usableHeight(chart);
      var bR = parseFloat(chart.dataset.before)||0.8, aR = parseFloat(chart.dataset.after)||0.9;
      var bBar = chart.querySelector('.ts__bar--before'), aBar = chart.querySelector('.ts__bar--after');
      if(bBar) bBar.style.setProperty('--bar-h','0px');
      if(aBar) aBar.style.setProperty('--bar-h','0px');
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        if(bBar) bBar.style.setProperty('--bar-h', Math.round(useH*bR)+'px');
        if(aBar) aBar.style.setProperty('--bar-h', Math.round(useH*aR)+'px');
      }); });
    }
    function resetBars(slide){ slide.querySelectorAll('.ts__bar').forEach(function(b){ b.style.setProperty('--bar-h','0px'); }); }
    function activate(i){ slides.forEach(function(s,si){ s.classList.toggle('is-active', si===i); if(si===i) setBars(s); else resetBars(s); }); }

    function goTo(i){
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translate3d(' + (-index*100) + '%,0,0)';
      dots.forEach(function(d,di){ d.setAttribute('aria-selected', di===index?'true':'false'); });
      activate(index);
    }
    function next(){ goTo(index+1); }
    function prev(){ goTo(index-1); }
    function tick(){ if(!isPaused) next(); }
    function start(){ stop(); timer = setInterval(tick, DURATION); }
    function stop(){ if(timer) clearInterval(timer); }

    if(nextBtn) nextBtn.addEventListener('click', function(){ next(); start(); });
    if(prevBtn) prevBtn.addEventListener('click', function(){ prev(); start(); });
    dots.forEach(function(d,di){ d.addEventListener('click', function(){ goTo(di); start(); }); });
    root.addEventListener('mouseenter', function(){ isPaused=true; });
    root.addEventListener('mouseleave', function(){ isPaused=false; });
    root.addEventListener('touchstart', function(){ isPaused=true; }, {passive:true});
    root.addEventListener('touchend', function(){ isPaused=false; start(); }, {passive:true});

    var io = new IntersectionObserver(function(entries){
      if(entries.some(function(e){ return e.isIntersecting; })){ goTo(0); start(); io.disconnect(); }
    }, {threshold:0.2});
    io.observe(root);

    // 초기 첫 슬라이드 즉시 활성(막대 애니메이션 시작) — IO 미발동 환경 대비
    goTo(0);
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
