/* =====================================================================
   result.js — 결과페이지 컨트롤러
   ---------------------------------------------------------------------
   [흐름]
   1. sessionStorage에서 진단 답변 8개 로드
   2. 하나라도 비면 → 진단시작으로 리다이렉트 (직접 접근·이탈 재진입 방지)
   3. 서버 /calc(POST)로 답변 전송 → 판정+계산+분기 결과 꾸러미 수신 (async)
   4. verdict에 따라 가능/불가 뷰 하나만 표시
   5. 가능이면 data-fill 자리에 계산값 주입 + 블록5 버전 분기 + 히스토그램

   ※ 2단계: 계산·9갈래 분기는 서버(ai-debt Worker)에서 실행.
     프론트는 결과를 받아 그리는 껍데기. calc-nude.js·living-cost-nude.js 불필요.
     렌더가 참조하던 상수(UPLIFT_CAP·source·housingSource)는 서버 응답에 실려와
     applyShim()이 window.JindanCalc / window.LIVING_COST 에 되꽂아 기존 코드 유지.
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
    window.location.replace('./diagnosis-nude.html');
    return;
  }

  /* ---------- 3) 계산 (서버 /calc 호출) ----------
     2단계: 계산·9갈래 분기를 서버에서 실행(calc/living-cost 프론트 제거).
     동기 run()이 async fetch로 바뀌므로, 아래 분기·렌더를 콜백 안에서 실행. */
  var CALC_URL = 'https://ai-debt.softman007.workers.dev/calc';

  var viewAccept = root.querySelector('[data-rz="accept"]');
  var viewReject = root.querySelector('[data-rz="reject"]');

  runCalc(answers);

  function runCalc(answers) {
    fetch(CALC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers)
    })
    .then(function (res) {
      if (!res.ok) throw new Error('calc_http_' + res.status);
      return res.json();
    })
    .then(function (r) {
      if (!r || !r.verdict) throw new Error('calc_bad_response');
      applyShim(r);      // 렌더 코드가 참조하는 전역값을 서버 응답으로 채움
      render(r);
    })
    .catch(function (err) {
      showCalcError();   // 네트워크·서버 오류 시 안내(무한 로딩 방지)
    });
  }

  /* 서버 응답에 실려온 상수로 window shim 구성 —
     기존 렌더 코드의 window.LIVING_COST / window.JindanCalc 참조를 그대로 살림
     (calc-nude.js·living-cost-nude.js 를 프론트에서 제거해도 동작) */
  function applyShim(r) {
    window.JindanCalc = window.JindanCalc || {};
    if (typeof r.upliftCap === 'number') window.JindanCalc.UPLIFT_CAP = r.upliftCap;
    window.LIVING_COST = window.LIVING_COST || {};
    if (r.source)        window.LIVING_COST.source = r.source;
    if (r.housingSource) window.LIVING_COST.housingSource = r.housingSource;
  }

  /* ---------- 4) 뷰 분기 + 5) 값 주입 ---------- */
  /* 결과 로딩 오버레이 걷어내기 — 화면을 다 그린 직후 호출.
     계산이 빠르든 느리든 '결과 완성 시점'에 딱 맞춰 사라지므로 흰 화면이 없다.
     (한 프레임 뒤에 숨겨 렌더 완료 후 페이드아웃되게 함) */
  function hideResultLoading() {
    var ov = document.getElementById('result-loading');
    if (!ov) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ov.classList.add('is-hidden'); });
    });
  }

  function render(r) {
    if (r.verdict === 'reject') {
      viewReject.classList.add('is-active');
      bindReject();
      hideResultLoading();
      return;
    }
    viewAccept.classList.add('is-active');

    fillAccept(r);
    bindAccept();
    renderChart(r);
    hideResultLoading();
  }

  /* 계산 실패(네트워크/서버) 안내 — reject 뷰를 재사용해 '다시 시도' 유도 */
  function showCalcError() {
    if (viewReject) {
      viewReject.classList.add('is-active');
      bindReject();
      hideResultLoading();
    } else {
      window.location.replace('./diagnosis-nude.html');
    }
  }

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

    // 블록5 (탕감률 상승 여지) — 버전 분기
    // 탕감률 90% 초과면 '더 올림'이 무의미(상한 95 근처/초과) → 상위 N% 표기.
    //   - factor=income & 90%초과 → 소득기준 상위N% 박스(income-high)
    //   - factor=minimum → 최저변제 상위N% 박스(minimum)
    // 90% 이하면 상승형(income/asset).
    var ratePct = pctNum(r.rate);
    var incomeVer = viewAccept.querySelector('[data-rz="uplift-income"]');
    var assetVer  = viewAccept.querySelector('[data-rz="uplift-asset"]');
    var minVer    = viewAccept.querySelector('[data-rz="uplift-minimum"]');
    var incHiVer  = viewAccept.querySelector('[data-rz="uplift-income-high"]');

    function hideAll() {
      incomeVer.style.display = 'none';
      assetVer.style.display  = 'none';
      minVer.style.display    = 'none';
      if (incHiVer) incHiVer.style.display = 'none';
    }

    if (r.factor === 'minimum') {
      // 최저변제 — 항상 상위 N%
      hideAll();
      minVer.style.display = 'block';
      fillUpliftMinimum(r);
      set('uplift-cta-line', '상담을 통해 정확한 탕감률을 확인할 수 있어요');
    } else if (ratePct > 90) {
      // 소득/재산인데 탕감률 90% 초과 — 소득기준 상위 N% 박스
      hideAll();
      if (incHiVer) incHiVer.style.display = 'block';
      fillUpliftIncomeHigh(r);
      set('uplift-cta-line', '상담을 통해 정확한 탕감률을 확인할 수 있어요');
    } else {
      // 90% 이하 — 상승형
      hideAll();
      incomeVer.style.display = (r.factor === 'income') ? 'block' : 'none';
      assetVer.style.display  = (r.factor === 'asset')  ? 'block' : 'none';
      var sfx = (r.factor === 'asset') ? '-asset' : '';
      fillUplift(r, sfx);
      // 소득/재산은 기본 CTA 라인 유지(HTML 기본값)
    }
  }

  /* 블록5 게이지·수치 채우기 — 소득/재산 버전 (상승형) --------------------
     현재 탕감률 → 목표치(upliftTarget) 를 게이지로. 상한 90 트랙 스케일 */
  function fillUplift(r, sfx) {
    var UP_MAX = window.JindanCalc.UPLIFT_CAP || 95;   // 트랙 상한(서버 upliftCap=95와 동일)
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

  /* 블록5 — 소득/재산 factor인데 탕감률 90% 초과 (상위 N%형, income 카피) ----
     로직은 minimum과 동일(상위 N%), 키만 -inchigh. HTML 카피가 소득기준용. */
  function fillUpliftIncomeHigh(r) {
    var cur = pctNum(r.rate);
    var top = topPercentile(cur);

    set('rate-plain-inchigh', pct(r.rate));
    set('uplift-rank-inchigh', '상위 ' + top + '%');

    var w = Math.min(Math.round(cur), 100);
    var bar = viewAccept.querySelector('[data-fill="uplift-bar-inchigh"]');
    var dot = viewAccept.querySelector('[data-fill="uplift-dot-inchigh"]');
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

  /* ---------- 리드 모달 — 팝업 껍데기(열기/닫기/약관)만 담당 ----------
     ★ 역할 분담: 이 파일(result.js)은 팝업을 여닫고 약관 모달을 띄우는 것까지만.
        전화번호 하이픈·번호인증·입력검증·실제 제출은 전부 lead-form.js가 전담한다.
        (lead-phone 등은 lead-form.js가 주인이므로 여기서 중복 바인딩하지 않음) */
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
  }

  function bindReject() {
    var back = viewReject.querySelector('[data-rz="back"]');
    if (back) back.addEventListener('click', function () { history.back(); });

    var retry = viewReject.querySelector('[data-rz="retry"]');
    if (retry) retry.addEventListener('click', function () {
      // 다시 진단: 답변 비우고 진단 처음으로
      KEYS.forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
      window.location.href = './diagnosis-nude.html';
    });
  }

})();