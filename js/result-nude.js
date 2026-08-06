/* =====================================================================
   result.js — 결과페이지 컨트롤러
   ---------------------------------------------------------------------
   [흐름]
   1. sessionStorage에서 진단 답변 8개 로드
   2. 하나라도 비면 → 진단시작으로 리다이렉트 (직접 접근·이탈 재진입 방지)
   3. JindanCalc.run()으로 판정+계산
   4. verdict에 따라 가능/불가 뷰 하나만 표시
   5. 가능이면 data-fill 자리에 계산값 주입 + 블록5 버전 분기 + 히스토그램

   ※ 계산 자체는 calc.js(순수함수). 여기선 로드·렌더·분기만 담당.
===================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-rz="root"]');
  if (!root) return;

  var KEYS = ['q_region','q_marital','q_dependents','q_income',
              'q_assets','q_secured','q_immunity','q_debt'];

  /* ---------- 탕감률 분포 (블록3 히스토그램 + 블록5 상위% 공용) ----------
     서울회생법원 통계 기반 근사. 실제 정확값 확보 시 이 배열만 교체 */
  var DIST_LABELS = ['0-20%','20-40%','40-60%','60-70%','70-80%','80-90%','90%+'];
  var DIST_DATA   = [4, 9, 22, 31, 24, 9, 1];
  var DIST_TOTAL  = DIST_DATA.reduce(function (s, v) { return s + v; }, 0);

  // 탕감률(%) → 구간 인덱스
  function bucketIndex(p) {
    if (p < 20) return 0;
    if (p < 40) return 1;
    if (p < 60) return 2;
    if (p < 70) return 3;
    if (p < 80) return 4;
    if (p < 90) return 5;
    return 6;
  }

  // 탕감률(%) → 상위 N% (내 구간 이상이 전체에서 차지하는 비율)
  // 예: 90%+ 구간(빈도 1)이면 상위 1/100 → "상위 1%"
  function topPercentile(p) {
    var idx = bucketIndex(p);
    var atOrAbove = 0;
    for (var i = idx; i < DIST_DATA.length; i++) atOrAbove += DIST_DATA[i];
    var pct = Math.round(atOrAbove / DIST_TOTAL * 100);
    return Math.max(1, pct);   // 최소 1% (0% 표기 방지)
  }

  /* ---------- 1) 답변 로드 ---------- */
  function loadAnswers() {
    var a = {};
    for (var i = 0; i < KEYS.length; i++) {
      var v = null;
      try { v = sessionStorage.getItem(KEYS[i]); } catch (e) {}
      a[KEYS[i]] = v;
    }
    return a;
  }

  var answers = loadAnswers();

  /* ---------- 2) 가드: 답변 누락 시 진단으로 ---------- */
  // 재산(q_assets)은 '0'이 유효값이므로 null/빈문자만 누락으로 판정
  var missing = KEYS.some(function (k) {
    var v = answers[k];
    return v === null || v === '';
  });
  if (missing) {
    window.location.replace('./diagnosis.html');
    return;
  }

  /* ---------- 3) 계산 ---------- */
  var r = window.JindanCalc.run(answers);

  /* ---------- 4) 뷰 분기 ---------- */
  var viewAccept = root.querySelector('[data-rz="accept"]');
  var viewReject = root.querySelector('[data-rz="reject"]');

  if (r.verdict === 'reject') {
    viewReject.classList.add('is-active');
    bindReject();
    return;
  }
  viewAccept.classList.add('is-active');

  /* ---------- 5) 값 주입 ---------- */
  fillAccept(r);
  bindAccept();
  renderChart(r);

  /* =====================================================================
     금액 포맷 — 원 단위 숫자 → "N,NNN만원" / "N억 N,NNN만원"
  ===================================================================== */
  function won(n) {
    n = Math.round(n);
    var eok = Math.floor(n / 100000000);
    var man = Math.round((n % 100000000) / 10000);   // 만원 단위 반올림
    var parts = [];
    if (eok) parts.push(eok.toLocaleString() + '억');
    if (man || !eok) parts.push(man.toLocaleString() + '만원');
    return parts.join(' ');
  }
  /* 가용소득 전용 — 만원 미만 양수를 "0만원"으로 뭉개지 않고 원 단위로 살림
     (예: 2,300원 → "2,300원", 780,000원 → "78만원"). 소수점은 반올림 */
  function wonFine(n) {
    n = Math.round(n);
    if (n > 0 && n < 10000) return n.toLocaleString() + '원';  // 만원 미만 양수
    return won(n);
  }
  function pct(rate) { return '약 ' + Math.round(rate * 100) + '%'; }
  function pctPlain(rate) { return (Math.round(rate * 1000) / 10) + '%'; }

  function set(key, text) {
    var els = viewAccept.querySelectorAll('[data-fill="' + key + '"]');
    els.forEach(function (el) { el.textContent = text; });
  }
  // HTML 태그(<br>, <span> 등)를 그대로 반영해야 하는 문구용
  function setHtml(key, html) {
    var els = viewAccept.querySelectorAll('[data-fill="' + key + '"]');
    els.forEach(function (el) { el.innerHTML = html; });
  }
  function setLong(key, isLong) {
    var els = viewAccept.querySelectorAll('[data-fill="' + key + '"]');
    els.forEach(function (el) { el.classList.toggle('is-long', isLong); });
  }

  /* =====================================================================
     가능 뷰 값 채우기
  ===================================================================== */
  function fillAccept(r) {
    // 블록1 (원금 + 예상이자 → 회생후, 탕감액·탕감률)
    set('principal', won(r.principal));
    set('interest',  won(r.interest));
    set('repay',     won(r.repay));
    set('reduced',   won(r.reduced));
    set('rate',      pct(r.rate));

    if (r.overCap) {
      // 재산·최저 60개월 초과 — 월변제 칸에 가용소득(=monthly) + 아래 상담 안내
      // wonFine으로 만원미만 양수도 원단위 표시 → 블록2 가용소득과 동일값
      set('monthly', wonFine(r.monthly));
      set('monthly-note', '전문가 상담 필요');
      setLong('monthly', false);
      set('months',  '60개월 초과');
      set('months-note',  '전문가 상담 필요');
      setLong('months',  true);
    } else {
      set('monthly', won(r.monthly));
      set('months',  r.months + '개월');
      set('monthly-note', '');
      set('months-note',  '');
      setLong('monthly', false);
      setLong('months',  false);
    }

    // 블록2 카드1 (변제금 근거) — factor별 3버전 분기, 하나만 표시
    var calcIncome = viewAccept.querySelector('[data-rz="calc-income"]');
    var calcAsset  = viewAccept.querySelector('[data-rz="calc-asset"]');
    var calcMin    = viewAccept.querySelector('[data-rz="calc-minimum"]');
    calcIncome.style.display = (r.factor === 'income')  ? 'block' : 'none';
    calcAsset.style.display  = (r.factor === 'asset')   ? 'block' : 'none';
    calcMin.style.display    = (r.factor === 'minimum') ? 'block' : 'none';

    var costLabel = '생계비(' + r.household + '인가구)';

    /* 생계비 줄 + 지역 주거비 줄 채우기 (옵션Y: 순수 생계비와 지역 주거비 분리)
       - 생계비 줄: 순수 중위소득60%(baseCost) — 보건복지부 출처값 그대로
       - 지역 주거비 줄: housing(권역한도×50%). 0이면 줄 숨김(빈 지역·미매핑) */
    function fillCostRows(sfx) {
      set('cost-label' + sfx, costLabel);
      set('cost' + sfx, '− ' + won(r.baseCost));
      var hrow = viewAccept.querySelector('[data-rz="housing-row' + sfx + '"]');
      if (r.housing > 0) {
        set('housing-label' + sfx, '지역 주거비(' + r.region + ')');
        set('housing' + sfx, '− ' + won(r.housing));
        if (hrow) hrow.style.display = 'flex';
      } else {
        if (hrow) hrow.style.display = 'none';
      }
    }

    if (r.factor === 'income') {
      // 소득기준
      set('income',   won(r.income));
      fillCostRows('');
      set('usable',   won(r.usable));
      var incFormula = viewAccept.querySelector('[data-rz="income-formula"]');
      var incMult    = viewAccept.querySelector('[data-rz="income-mult"]');
      var incLead    = viewAccept.querySelector('[data-rz="income-lead"]');
      var incNote    = viewAccept.querySelector('[data-rz="income-note"]');
      set('repay-2', won(r.repay));
      if (r.shortened) {
        // 단축(원금 조기완납): 명분 박스는 유지하되 곱셈→명분 문구로,
        // 아래에 안내문구 추가 (재산·최저와 동일한 명분+부연 구조)
        incMult.style.display = 'none';
        incLead.style.display = 'block';
        incNote.style.display = 'block';
        setHtml('income-lead', '회생 변제기간은 원칙 3년이지만,<br>'+'원금을 다 갚으면 법원이 조기 종료를 인정해요');
        setHtml('income-note', '원금을 월 가용소득으로 나눠 <br>' + '<span style="color:#0b5bd3;font-weight:700">' + r.months + '개월'+'</span>'+'간 나누어 갚는게 원칙이에요.');
      } else {
        // 일반 36개월: 가용소득 × 36 = 회생변제금 (곱셈 정확)
        incMult.style.display = 'inline';
        incLead.style.display = 'none';
        incNote.style.display = 'none';
        set('usable-2', won(r.usable));
        set('months-2', r.months + '개월');
      }
    } else if (r.factor === 'asset') {
      // 재산기준: 보유 재산(청산가치)이 변제금 결정
      set('income-a',      won(r.income));
      fillCostRows('-a');
      set('usable-a',      wonFine(r.usable));
      set('assets-a',      won(r.assets));
      set('repay-a',       won(r.repay));
      // 안내 문구: 60개월 초과일 때만 "기간을 넘어요", 이내면 정상 변제 안내
      if (r.overCap) {
        setHtml('asset-note', '현재 가용소득으로 재산만큼 갚으려면<br>'+'법이 정한 기간(최대 60개월)을 넘어요<br>'+'<span style="color:#0b5bd3;font-weight:700">'+'전문가의 의견이 필요해요'+'</span>');
      } else {
        setHtml('asset-note', '청산가치를 월 가용소득으로 나눠<br>' + '<span style="color:#0b5bd3;font-weight:700">' + r.months + '개월'+'</span>'+'간 나누어 갚는게 원칙이에요');
      }
    } else {
      // 최저변제액: 법정 최저 변제 기준
      set('income-m',      won(r.income));
      fillCostRows('-m');
      set('usable-m',      wonFine(r.usable));
      set('min-m',         won(r.minRepay));
      set('repay-m',       won(r.repay));
      // 안내 문구: 60개월 초과일 때만 "기간을 넘어요", 이내면 정상 변제 안내
      if (r.overCap) {
        setHtml('min-note', '현재 가용소득으로 최저변제금을 갚으려면<br>'+'법이 정한 기간(최대 60개월)을 넘어요<br>'+'<span style="color:#0b5bd3;font-weight:700">'+'전문가의 의견이 필요해요'+'</span>');
      } else {
        setHtml('min-note', '법정 최저 변제금을 월 가용소득으로 나눠<br>' + '<span style="color:#0b5bd3;font-weight:700">' + r.months + '개월'+'</span>'+ '간 나누어 갚는게 원칙이에요.');
      }
    }

    // 블록2 카드2 (탕감 구조: 원금 + 이자 − 회생후 = 탕감액) — 공통
    set('principal-2', won(r.principal));
    set('interest-2',  '＋ ' + won(r.interest));
    set('repay-3',     '− ' + won(r.repay));
    set('reduced-2',   won(r.reduced));
    set('interest-3',  won(r.interest));
    if (window.LIVING_COST && window.LIVING_COST.source) {
      var srcTxt = '출처 · ' + window.LIVING_COST.source;
      var hNote = viewAccept.querySelector('[data-rz="housing-note"]');
      if (r.housing > 0 && window.LIVING_COST.housingSource) {
        // 지역 주거비 적용 시: 출처에 서울회생법원 기준 병기 + 면책 문구 표시
        srcTxt += ', ' + window.LIVING_COST.housingSource;
        if (hNote) hNote.style.display = 'block';
      } else {
        if (hNote) hNote.style.display = 'none';
      }
      set('cost-source', srcTxt);
    }

    // 블록5 (탕감률 상승 여지) — 3버전 분기
    var incomeVer = viewAccept.querySelector('[data-rz="uplift-income"]');
    var assetVer  = viewAccept.querySelector('[data-rz="uplift-asset"]');
    var minVer    = viewAccept.querySelector('[data-rz="uplift-minimum"]');

    incomeVer.style.display = (r.factor === 'income')  ? 'block' : 'none';
    assetVer.style.display  = (r.factor === 'asset')   ? 'block' : 'none';
    minVer.style.display    = (r.factor === 'minimum') ? 'block' : 'none';

    if (r.factor === 'minimum') {
      fillUpliftMinimum(r);
      // CTA 라인: 월 부담 축 (탕감률 방어 → 확인)
      set('uplift-cta-line', '상담을 통해 정확한 탕감률을 확인할 수 있어요');
    } else {
      var sfx = (r.factor === 'asset') ? '-asset' : '';
      fillUplift(r, sfx);
      // 소득/재산은 기본 CTA 라인 유지(HTML 기본값)
    }
  }

  /* 블록5 게이지·수치 채우기 — 소득/재산 버전 (상승형) --------------------
     현재 탕감률 → 목표치(upliftTarget) 를 게이지로. 상한 90 트랙 스케일 */
  function fillUplift(r, sfx) {
    var UP_MAX = window.JindanCalc.UPLIFT_CAP || 90;   // 트랙 상한
    var curPct = Math.min(pctNum(r.rate), UP_MAX);     // 현재 탕감률(%)
    var target = r.upliftTarget;                       // 목표 탕감률(%)

    set('rate-plain' + sfx, pct(r.rate));
    set('uplift-max' + sfx, '최대 ' + Math.round(target) + '%');

    var curW = Math.round(curPct / UP_MAX * 100);
    var tgtW = Math.round(target / UP_MAX * 100);
    var bar = viewAccept.querySelector('[data-fill="uplift-bar' + sfx + '"]');
    var dot = viewAccept.querySelector('[data-fill="uplift-dot' + sfx + '"]');
    if (bar) bar.style.width = curW + '%';
    if (dot) dot.style.left  = tgtW + '%';
  }

  /* 블록5 게이지·수치 채우기 — 최저변제액 버전 (상위 N%형) ----------------
     이미 탕감률이 최상위(92~97%). '더 올림'이 아니라 '상위 몇 %'로 표현.
     게이지는 현재 탕감률을 100 트랙에 그대로(거의 꽉 참), dot도 같은 위치 */
  function fillUpliftMinimum(r) {
    var cur = pctNum(r.rate);                          // 현재 탕감률(%)
    var top = topPercentile(cur);                      // 상위 N%

    set('rate-plain-min', pct(r.rate));
    set('uplift-rank-min', '상위 ' + top + '%');

    // 게이지: 현재 탕감률을 100 트랙에 표시(이미 꽉 참). dot도 현재 위치
    var w = Math.min(Math.round(cur), 100);
    var bar = viewAccept.querySelector('[data-fill="uplift-bar-min"]');
    var dot = viewAccept.querySelector('[data-fill="uplift-dot-min"]');
    if (bar) bar.style.width = w + '%';
    if (dot) dot.style.left  = w + '%';
  }

  function pctNum(rate) { return Math.round(rate * 1000) / 10; }

  /* =====================================================================
     히스토그램 (블록3) — 내 탕감률이 속한 구간 강조
  ===================================================================== */
  function renderChart(r) {
    var canvas = viewAccept.querySelector('[data-rz="chart"]');
    if (!canvas || typeof Chart === 'undefined') return;

    var labels = DIST_LABELS;
    var data   = DIST_DATA;

    // 내 탕감률(%) → 구간 인덱스
    var p = r.rate * 100;
    var myIndex = bucketIndex(p);

    var bg = labels.map(function (l, i) {
      return i === myIndex ? '#0b5bd3' : '#dbe9fb';
    });

    var myLabel = '내 위치 ' + Math.round(p) + '%';

    new Chart(canvas, {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: bg, borderRadius: 4, barPercentage: 0.75 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#9aa7b6' } },
          y: { display: false }
        }
      },
      plugins: [{
        id: 'myMarker',
        afterDraw: function (chart) {
          var bar = chart.getDatasetMeta(0).data[myIndex];
          if (!bar) return;
          var c = chart.ctx;
          c.save();
          c.font = '600 10px sans-serif';
          c.fillStyle = '#0b5bd3';
          c.textAlign = 'center';
          c.fillText(myLabel, bar.x, bar.y - 8);
          c.restore();
        }
      }]
    });
  }

  /* =====================================================================
     버튼 바인딩
  ===================================================================== */
  function bindAccept() {
    var back = viewAccept.querySelector('[data-rz="back"]');
    if (back) back.addEventListener('click', function () { history.back(); });

    var cta = viewAccept.querySelector('[data-rz="cta"]');
    if (cta) cta.addEventListener('click', openLeadModal);

    bindLeadModal();
  }

  /* ---------- 리드 모달 (번호인증 · UI만) ----------
     열기/닫기, 통화시간 버튼, 전화번호 하이픈 자동, 인증 UI 토글까지.
     ★실제 OTP 발송·검증·구글폼 전송은 추후 연결 (TODO 표시된 자리). */
  function openLeadModal() {
    var m = document.querySelector('[data-rz="lead-modal"]');
    if (!m) return;
    m.hidden = false;
    document.body.classList.add('lead-open');
    var panel = m.querySelector('.lead__panel');
    if (panel) panel.scrollTop = 0;
  }
  function closeLeadModal() {
    var m = document.querySelector('[data-rz="lead-modal"]');
    if (!m) return;
    m.hidden = true;
    document.body.classList.remove('lead-open');
  }
  function bindLeadModal() {
    var m = document.querySelector('[data-rz="lead-modal"]');
    if (!m) return;

    // 닫기: X 버튼 · 딤 클릭 · ESC
    var closeBtn = m.querySelector('[data-rz="lead-close"]');
    var dim      = m.querySelector('[data-rz="lead-dim"]');
    if (closeBtn) closeBtn.addEventListener('click', closeLeadModal);
    if (dim)      dim.addEventListener('click', closeLeadModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !m.hidden) closeLeadModal();
    });

    // 통화 가능 시간: select (별도 로직 불필요)

    // 전화번호 하이픈 자동 (010-0000-0000)
    var phone = m.querySelector('[data-rz="lead-phone"]');
    if (phone) phone.addEventListener('input', function () {
      var v = phone.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 7)      v = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7);
      else if (v.length > 3) v = v.slice(0,3) + '-' + v.slice(3);
      phone.value = v;
    });

    // 인증번호 입력 UI는 OTP JS가 lead-otp-slot에 삽입 (별도 로직 없음)

    // 약관 전문 보기 → 개인정보 약관 모달 오픈
    var terms = m.querySelector('[data-rz="lead-terms"]');
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

    // 제출 버튼 (UI만 · 전송은 추후)
    var submit = m.querySelector('[data-rz="lead-submit"]');
    if (submit) submit.addEventListener('click', function () {
      // TODO(연결): 필드 검증 + 인증 확인 + 구글폼/제휴사폼 전송 → 땡큐페이지 이동.
    });
  }

  function bindReject() {
    var back = viewReject.querySelector('[data-rz="back"]');
    if (back) back.addEventListener('click', function () { history.back(); });

    var retry = viewReject.querySelector('[data-rz="retry"]');
    if (retry) retry.addEventListener('click', function () {
      // 다시 진단: 답변 비우고 진단 처음으로
      KEYS.forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
      window.location.href = './diagnosis.html';
    });
  }

})();