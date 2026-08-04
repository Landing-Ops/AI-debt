/* =====================================================================
   traffic.js — 유입경로 파싱·저장 (읽기 전용 소스)
   ---------------------------------------------------------------------
   [역할]
   랜딩 도착 시 1회, URL 파라미터(mp·rg·ag·ad)를 파싱해 규칙대로 변환하고
   sessionStorage(키: traffic)에 저장한다. 이후 진단·결과·팝업 화면은
   URL을 보지 않고 이 저장값만 참조한다(화면 이동 중 파라미터 누락 방지).

   [기술구현 기획안 3번 근거]
   - mp(매체)·rg(지역): 화이트리스트에 있는 값만 인정, 한글로 변환
   - ag(연령): 이번 서비스에선 값 조합에 미사용. 구조만 남겨둠(주석)
   - ad(소재ID): 화이트리스트 없이 들어온 값 그대로 신뢰
   - 최종 저장 형태: { media, region, ad } → 시트 전달 시
     유입경로="매체-지역", 소재ID=ad 로 분리 사용

   [OFF 방법]
   index.html에서 이 <script> 태그만 제거하면 됨. 저장값이 없으면
   이후 화면은 기본값('직접유입' 등)으로 폴백하도록 설계할 것.
===================================================================== */
(function () {
  'use strict';

  var KEY = 'traffic';   // ★ footer 계열의 'footer_media'와 분리 — 겹치지 않게

  /* ---------- 화이트리스트 (미리 정한 값만 인정) ---------- */
  var MEDIA_MAP = {
    meta:'메타', facebook:'페이스북', insta:'인스타', instagram:'인스타',
    google:'구글', youtube:'유튜브', tiktok:'틱톡',
    carrot:'당근', kakao:'카카오', naversa:'네이버SA', naverda:'네이버DA',
    direct:'직접유입'
  };
  var REGION_MAP = {
    all:'전국', seoul:'서울', busan:'부산', daegu:'대구', incheon:'인천',
    gwangju:'광주', daejeon:'대전', ulsan:'울산', sejong:'세종',
    gyeonggi:'경기', gangwon:'강원', chungbuk:'충북', chungnam:'충남',
    jeonbuk:'전북', jeonnam:'전남', gyeongbuk:'경북', gyeongnam:'경남', jeju:'제주'
  };

  var qs = new URLSearchParams(location.search);
  function pick(name){ return (qs.get(name) || '').trim().toLowerCase(); }

  var mpRaw = pick('mp');
  var rgRaw = pick('rg');
  var adRaw = (qs.get('ad') || '').trim();   // 소재ID는 원문 대소문자 유지
  // var agRaw = pick('ag');   // 연령: 이번 서비스 미사용. 다른 캠페인 대비 구조만 남김

  // URL에 파라미터가 있으면 파싱해 저장, 없으면(재방문 등) 이전 값 재사용
  var hasParam = mpRaw || rgRaw || adRaw;

  if (hasParam) {
    var traffic = {
      media:  MEDIA_MAP[mpRaw]  || '직접유입',
      region: REGION_MAP[rgRaw] || '전국',
      ad:     adRaw || ''
      // age: agRaw || ''   // 미사용
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(traffic)); } catch (e) {}
  }
  // 파라미터 없이 들어온 경우: 기존 저장값 유지(sessionStorage가 자동 보존).
  // 최초 진입 + 파라미터 없음 = 저장 안 함 → 이후 화면이 기본값으로 폴백.

})();
