/* =====================================================================
   review-cards.js  —  섹션2 후기 카드 슬라이드 + 상세 팝업 + 이미지 라이트박스
   - 좌우 버튼 없음. 터치 스와이프 / 마우스 드래그로 넘김
   - 카드 또는 "이어서 읽기" 클릭 시 팝업에 상세 데이터 채워서 노출
   - 팝업 상단(tags 아래)에 카드와 동일한 사진 2장을 나란히 노출, 클릭 시 라이트박스 확대
   - 본문(review)은 카드처럼 텍스트 하나로 쭉 이어짐
   - 팝업 데이터는 이 파일 상단 REVIEW_DATA에서 관리 (HTML 수정 없이 내용 교체 가능)
===================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.rv');
  if (!root) return;

  /* ---------- 후기 상세 데이터 (id는 HTML의 li#review-N과 매칭) ---------- */
  var REVIEW_DATA = {
    'review-1': {
      avatar: './img/avatar001.png',
      name: '김XX님',
      meta: '서울특별시',
      tags: ['직장인'],
      photos: ['./img/tx_decision_LJY1.png', './img/tx-LJY-review1.png'],
      stars: 5,
      goodLabel: '채무 조정 결과',
      good: [
      '총 채무액: 50,154,200원',
      '탕감액: 46,141,856원',
      '월 변제금: 111,454원',
      '변제기간: 36개월'
      ],
      reviewLabel: '채무 경위와 회생 성공 수기',
      review:
      '인테리어 현장에서 목수로 일하고 있습니다. 기술 하나 믿고 땀 흘려 일하면 굶지 않을 거라 굳게 믿었어요. 그런데 재작년 무거운 합판을 들다 어깨가 파열돼 큰 수술을 받았습니다. 반년 넘게 쉬며 수입이 끊겼고, 당장 급한 수술비와 생활비를 카드로 막다 보니 어느새 빚이 5천만 원 넘게 불어나 있더군요.\n\n' +
      '다시 현장에 복귀했지만 벌어오는 일당은 고스란히 이자로 빠져나갔습니다. 그러던 어느 날, 중학생 딸이 "아빠, 왜 자꾸 한숨 쉬어?" 묻는데 가슴이 쿵 내려앉아 화장실에 들어가 한참을 못 나왔습니다. 매일 밤을 지옥처럼 보내던 중, 제 사정을 아는 친한 형님이 본인도 도움받았다며 이정용 법률사무소를 권하셨습니다. 솔직히 처음엔 두려움이 앞섰습니다.\n\n' +
      '일당 받는 계좌가 정지되거나, 주변에 소문이 날까 봐 며칠을 밤잠을 설쳤거든요. 하지만 사무소에서 상담을 받아보니 제 걱정은 기우에 불과했습니다. 사무장님께서 회생 절차 중에도 통장을 그대로 쓸 수 있고, 직장이나 주변에는 절대 안 알려진다고 안심시켜 주셔서 그제야 꽉 막힌 숨이 쉬어졌습니다. 지금은 다행히 잘 해결돼서 매달 11만 원 남짓 변제하고 있습니다.\n\n' +
      '원금 92%를 덜어내고 3년 뒤면 끝이라는 확신이 생기니, 이제는 이자 갚는 날이 와도 전혀 불안하지 않네요. 요즘은 퇴근 후 우리 딸 얼굴도 미안함 없이 웃으면서 봅니다. 제가 글재주가 뛰어난 사람이 아니라 어색하지만, 고마운 마음을 전하고 싶어 서툴게나마 진심을 적어봅니다. 벼랑 끝에서 손을 잡아주신 사무장님과 이정용 변호사님, 진심으로 감사합니다.\n\n' +
      '혹시 제 글을 읽으며 빚 때문에 홀로 속앓이하는 분이 있다면, 절대 포기하지 마세요. 막일하는 저 같은 사람도 새 삶을 얻었으니 여러분도 분명 해내실 수 있습니다. 혼자 앓지 말고 꼭 한번 이정용 변호사님께 도움받아보세요.'
    },
    'review-2': {
      avatar: './img/avatar002.png',
      name: '박XX님',
      meta: '부산광역시',
      tags: ['일용직'],
      photos: ['./img/tx_decision_LJY2.png', './img/tx-LJY-review2.png'],
      stars: 5,
      goodLabel: '채무 조정 결과',
      good: [
        '총 채무액: 247,583,924원',
        '탕감액: 232,728,776원',
        '월 변제금: 412,643원',
        '변제기간: 36개월'
      ],
      reviewLabel: '채무 경위와 회생 성공 수기',
      review:
      '물류센터 일용직과 야간 택배 상하차 일을 병행하며 두 아이를 홀로 키웠습니다. 아내와 헤어진 뒤로 혼자 생계를 꾸리다 보니, 월세에 아이들 교육비와 식비만 나가도 매달 마이너스가 났어요.\n\n' +
      '모자란 돈을 카드로 막고 대출로 돌려막길 몇 년, 어느 날 정신을 차려보니 빚이 2억 4천7백만 원이 넘었더군요. 새벽부터 나가 밤늦게 파김치가 되도록 일해도, 일당을 받자마자 이자로 다 빠져나가고 당장 월세 낼 돈조차 안 남았습니다.\n\n' +
      '끝없는 이자 독촉에 시달리며 빚만 갚다 보니 이게 사는 건가 싶어 매일 밤잠을 설쳤습니다. 그렇게 벼랑 끝에 서 있을 때, 현장에서 친해진 제 사정을 잘 아는 동료 형님이 본인도 도움받았다며 이정용 변호사님을 얘기해주더군요.\n\n' +
      '솔직히 처음엔 망설였습니다. 당장 밥 사 먹을 돈도 없고 이자도 못 갚는 마당에 수임료는 무슨 돈으로 내나 싶었거든요. 비싸게 불러서 아예 시작도 못 하면 어쩌나 하는 걱정이 제일 컸습니다.\n\n' +
      '그런데 법률사무소 사무장님 통해서 상담받아보니 제 형편을 누구보다 잘 이해해 주셨고, 비용과 진행 방식을 처음부터 투명하게 다 알려주셨어요. 게다가 당장 큰돈이 없는 제 사정에 맞춰 부담 없이 낼 수 있게 배려해 주셔서 마음놓고 진행하게 되었습니다.\n\n' +
      '지금은 변호사님 덕분에 법원 통과가 잘 돼서, 매달 41만 원 정도 변제하고 있습니다. 감당 못 할 원금의 94%나 덜어내고 딱 3년만 갚으면 이 지긋지긋한 빚이 끝난다니 이제는 열심히 일하면 이자가 아니라 원금 갚고 우리 아이들 고기라도 사 먹일 수 있어 살 맛이 납니다.\n\n' +
      '요즘은 아이들 앞에서도 한숨 안 쉬고 밝고 당당한 아빠로 지내고 있습니다. 많이 힘들 때 제 편이 되어 도와주신 변호사 이정용 법률사무소 식구들과 변호사님, 사무장님께 고마운 마음을 전하고 싶어 진심을 적어봅니다. 진심으로 감사합니다.'
    },
    'review-3': {
      avatar: './img/avatar003.png',
      name: '이XX님',
      meta: '대구광역시',
      tags: ['프리랜서'],
      photos: ['./img/tx_decision_LJY3.png', './img/tx-LJY-review3.png'],
      stars: 5,
      goodLabel: '채무 조정 결과',
      good: [
        '총 채무액: 67,543,924원',
        '탕감액: 60,114,100원',
        '월 변제금: 206,384원',
        '변제기간: 36개월'
      ],
      reviewLabel: '채무 경위와 회생 성공 수기',
      review:
      '다니던 회사를 그만두고 프리랜서로 일할 때만 해도 어떻게든 될 줄 알았어요. 영상 편집을 뛰고 작은 작업실까지 차려 버텨보려 했거든요. 그런데 하필 엄마가 뇌졸중으로 크게 쓰러져 수입이 아예 끊겼습니다. 병원비에 작업실 월세, 생활비까지 카드 돌려막기로 버티다 보니 빚이 6천7백만 원 넘게 불어있더라고요.\n\n' +
      '매달 결제일마다 독촉 전화에 시달리고 밤마다 모니터 앞에서 소리 죽여 울던 날이 셀 수도 없어요. 그렇게 막막할 때 저를 아껴주던 피디 언니가 이정용 변호사님 법률사무소를 권해줬는데 처음엔 많이 망설였습니다. 혹시나 회생하면 평생 신용불량자로 낙인찍혀서 앞으로 카드도 대출도 영영 못 하는 거 아닌가 싶어 너무 무서웠거든요.\n\n' +
      '그런데 법률사무소에서 상담받아보니 그게 아니더라고요. 요즘은 1년만 성실히 잘 갚으면 회생 중에도 기록이 일찍 지워져서 신용카드도 다시 만들 수 있고 대출도 가능하다고, 절대 평생 가는 게 아니라고 설명해 주셔서 그제야 마음을 놓았습니다.\n\n' +
      '다행히 회생진행이 잘돼서 매달 20만원씩 3년 동안 갚아나가는 걸로 결정이 났습니다. 너무나 감사하게도 원금 89% 넘게 덜어내게 됐어요. 예전엔 돈을 갚아 봐도 원금은 단 1원도 안 줄어 눈앞이 깜깜했는데 이제는 내는 돈만큼 진짜 빚이 줄어든다는 생각에 결제일이 와도 불안하지가 않습니다.\n\n' +
      '엄마 간호하는 딸 입장에서 이제는 한숨 대신 내일을 이야기하게 되었네요. 제가 말주변도 없는 사람이라 고마운 마음이 제대로 적혔는지 모르겠습니다. 정말 제 인생에서 가장 앞이 안 보이던 시절에 귀찮은 내색 없이 끝까지 도와주신 변호사 이정용 법률사무소 식구분들께 진짜 머리 숙여 감사드립니다.\n\n' +
      '혹시 지금 저처럼 밤잠 못 이루며 이 글을 읽고 계신 분이 있다면 절대 포기하지 마세요. 혼자 끙끙 앓지 마시고 꼭 도움받아보세요. 저 같은 사람도 다시 일어섰으니 여러분도 분명히 해내실 수 있습니다.'
    },
    'review-4': {
      avatar: './img/avatar004.png',
      name: '정XX님',
      meta: '경기도 수원시',
      tags: ['자영업'],
      photos: ['./img/tx_decision_LJY4.png', './img/tx-LJY-review4.png'],
      stars: 5,
      goodLabel: '채무 조정 결과',
      good: [
        '총 채무액: 170,634,099원',
        '탕감액: 158,567,511원',
        '월 변제금: 342,023원',
        '변제기간: 36개월'
      ],
      reviewLabel: '채무 경위와 회생 성공 수기',
      review:
      '작게 김밥집을 운영하던 사람입니다. 목 좋은 곳에 큰맘 먹고 차렸는데 개업 얼마 후 가게 앞 도로 공사가 시작되면서 손님 발길이 뚝 끊겼어요. 어떻게든 버텨보려 대출을 썼고, 자리를 옮기면 나아질까 싶어 무리해서 이전한 게 더 큰 화근이었습니다.\n\n' +
      '직원 인건비에 월세, 재료비까지 돌려막다 보니 어느새 빚이 1억 7천만 원까지 불어났더라고요. 월세 날만 오면 숨이 턱턱 막혔고 밤마다 잠도 못 잤습니다. 공사 탓도 있지만, 어떻게든 해보겠다고 무리한 제 욕심이 컸으니 누구를 원망할 수도 없어 더 답답했어요.\n\n' +
      '그러다 자주 오시던 단골손님 한 분이 조용히 이정용 변호사님을 추천해주셨습니다. 사실 처음엔 회생을 신청하면 살고 있는 집 전세보증금까지 전부 뺏기는 건 아닌가 싶어 겁부터 났어요. 그게 제일 무서워서 망설였거든요.\n\n' +
      '그런데 사무장님과 상담을 받아보니까 제가 알던 거랑은 전혀 다르더라고요. 회생은 재산을 무조건 뺏는 게 아니라, 빚이 청산가치보다 크다면 오히려 재산을 지키면서 갚을 수 있는 만큼만 빚을 정리하는 제도라는 걸 그때 처음 알았습니다.\n\n' +
      '그렇게 도움을 받아 지금은 원리금 92% 정도를 덜어내고, 한 달에 34만 원씩 3년 동안 갚아나가는 걸로 결정 났습니다. 길거리에 나앉을까 봐 덜덜 떨었는데 살던 집 지키고 감당할 수 있는 돈만 내면 되니 그제야 밤에 잠이 오더군요.\n\n' +
      '이정용 변호사님, 사무장님 진심으로 감사하다는 말씀을 전합니다.'
    },
    'review-5': {
      avatar: './img/avatar005.png',
      name: '최XX님',
      meta: '인천광역시',
      tags: ['사업자'],
      photos: ['./img/tx_decision_LJY5.png', './img/tx-LJY-review5.png'],
      stars: 5,
      goodLabel: '채무 조정 결과',
      good: [
        '총 채무액: 421,110,943원',
        '탕감액: 401,793,415원',
        '월 변제금: 536,598원',
        '변제기간: 36개월'
      ],
      reviewLabel: '채무 경위와 회생 성공 수기',
      review:
      '공단에서 작은 금속가공 공장을 운영했었습니다. 회사 다니다가 거래처에서 밀어줄 테니 해보라는 권유에 큰맘 먹고 차렸었죠. 처음 몇 년은 그럭저럭 돌아갔는데, 주거래처 주문이 뚝 끊기면서 자금이 융통되지 않았고 결국 부도를 맞았습니다.\n\n' +
      '정신을 차려보니 빚만 4억 2천만 원 정도 쌓여 있더라고요. 공장 문 닫던 날, 텅 빈 작업장에 앉아 담배만 주구장창 피우며 한참을 못 일어났습니다. 먹고살아야 하니 막노동 현장을 전전했는데, 엎친 데 덮친 격으로 아버지까지 뇌졸중으로 쓰러지셨어요.\n\n' +
      '일당 받아 병원비 내고 나면 빚 독촉 전화에 시달리는 게 일상이었습니다. 그러다 아는 후배가 변호사 이정용 법률사무소를 알려주더군요. 처음에는 솔직히 망설였습니다. 나라에서 하는 제도인데 굳이 돈을 주고 사무실에 맡겨야 하나, 혼자 알아서 하면 되지 않나 싶었거든요.\n\n' +
      '그런데 직접 서류를 떼보려니까 빚이 4억이 넘고 얽힌 채권자도 여럿이라 무슨 말인지 하나도 모르겠더랍니다. 혼자 어설프게 하다가 기각돼서 회생 취소되는 사람도 많다는 이야기를 듣고 아차 싶었어요. 상담을 받아보니 왜 전문가가 필요한지 알겠더라고요. 법률사무소에서 그 복잡하고 막막한 서류 작업을 내 일처럼 다 정리해서 통과시켜 주셨습니다.\n\n' +
      '지금은 3년 동안 매달 54만 원씩만 변제하는 걸로 인가받아 갚고 있습니다. 원금의 95% 정도를 덜어낸 셈이죠. 예전에는 일당을 벌어도 이자 내기조차 턱없이 부족했는데, 이제는 정해진 돈만 딱 갚으면 되니까 생활에 숨통이 트입니다.\n\n' +
      '밤에 아버지 병실을 지키면서도 내일을 생각할 수 있게 됐어요. 이 짧은 글로는 제 마음을 다 전하긴 부족하지만 제 인생 가장 힘들었던 시기에 도와주신 이정용 변호사님과 사무장님, 법률사무소 식구들께 진심으로 감사하다는 말씀 전합니다.\n\n' +
      '혹시 저처럼 사업 접고 벼랑 끝에 서 계신 분이 이 글을 보신다면, 절대 포기하지 마세요. 저도 다시 일어섰으니, 여러분도 할 수 있습니다.'

    },
    'review-6': {
      avatar: './img/avatar006.png',
      name: '한XX님',
      meta: '광주광역시',
      tags: ['주식·코인'],
      photos: ['./img/tx_decision_LJY6.png', './img/tx-LJY-review6.png'],
      stars: 5,
      goodLabel: '채무 조정 결과',
      good: [
        '총 채무액: 546,429,600원',
        '탕감액: 480,858,048원',
        '월 변제금: 1,821,432원',
        '변제기간: 36개월'
      ],
      reviewLabel: '채무 경위와 회생 성공 수기',
      review:
      '고마운 마음을 전하고 싶어 부끄러움을 무릅쓰고 제 얘기를 적어봅니다. 몇 년 전 전세금을 불려보려 코인에 손을 댔다가 크게 물렸고 그 손실을 만회해보겠다고 신용대출까지 끌어와 무리하게 다시 투자를 했습니다. 폭락장으로 거액을 잃고도 본전 생각에 멈추지 못한 게 화근이었어요.\n\n' +
      '정신을 차려보니 빚이 5억 4천만 원 가까이 불어나 있더라고요. 월급날이 되어도 통장에 돈이 스쳐 지나가기 바빴고, 매달 불어나는 이자 막느라 날마다 독촉 전화에 시달리며 속을 끓였습니다. 누구를 탓할 수도 없는, 오롯이 제 욕심과 어리석음이 부른 결과라 아내에게 하소연도 못 하고 속으로만 삭였죠.\n\n' +
      '더는 버틸 힘이 없어 밤새 인터넷을 뒤지고 10곳 넘게 비교하다가 이정용 변호사님 사무소를 선택하게 되었습니다. 하지만 처음엔 선뜻 연락할 수가 없더라고요. 괜히 신청했다가 다니는 회사에 알려져서 불이익을 받거나, 통장이나 월급에 압류라도 들어오면 어쩌나 싶어서 차라리 혼자 조용히 버티는 게 낫지 않을까 한참을 망설였습니다.\n\n' +
      '그러다 용기 내어 연락드렸는데, 변호사님께서 오히려 회생을 신청하면 법원 금지명령이 나와서 지긋지긋한 추심과 압류가 멈춘다고 차분하게 설명해 주셨어요. 직장 생활에 전혀 지장이 안 간다는 사실을 알고 나서야 비로소 안심하고 결심할 수 있었습니다.\n\n' +
      '약 3개월 정도의 시간이 지나고 원금의 88% 이상을 탕감받는 정말 감사한 결정을 받았습니다. 이제는 매달 182만 원 정도씩 성실하게 갚아나가고 있어요. 예전에는 밑빠진 독에 물 붓듯 이자만 내며 살았는데, 이제는 내 빚을 실제로 지워나간다는 생각에 마음가짐부터 달라졌습니다.\n\n' +
      '내 인생에서 가장 힘들고 막막했던 순간에 따뜻하게 손 내밀어 주신 이정용 변호사님께 진심으로 감사드립니다. 혹시 지금 저처럼 빚 때문에 밤잠 설치며 이 글을 읽고 계신 분이 있다면 어리석었던 저도 도움을 받아 다시 일어섰으니 여러분도 분명히 해내실 수 있다고 말씀드립니다. 혼자서 끙끙 앓며 망설이지 마시고 꼭 이정용 변호사님께 도움받아보시길 권합니다.'
    },
    'review-7': {
      avatar: './img/avatar007.png',
      name: '윤XX님',
      meta: '제주특별자치도',
      tags: ['도박'],
      photos: ['./img/tx_decision_LJY7.png', './img/tx-LJY-review7.png'],
      stars: 5,
      goodLabel: '채무 조정 결과',
      good: [
        '총 채무액: 84,549,976원',
        '탕감액: 68,987,908원',
        '월 변제금: 433,113원',
        '변제기간: 36개월'
      ],
      reviewLabel: '채무 경위와 회생 성공 수기',
      review:
      '부끄럽게도 첫 직장 다니고 몇 년도 안 돼, 코인이랑 온라인 도박에 빠져 대출받은 돈을 다 날렸습니다. 잃은 돈을 메우려 돌려막기를 하다 보니 빚이 어느새 8천 4백만 원대까지 불어났더라고요. 월급날이 되어도 고스란히 이자로만 다 빠져나가니 매달 허탈했고, 하루 종일 독촉 전화가 올 때마다 숨이 막혔습니다.\n\n' +
      '이 사실을 가족들이 알까 봐 매일 조마조마하던 중 친구가 이정용 변호사님을 조심스레 귀띔해주었습니다. 사실 처음에는 선뜻 상담받기가 두려웠습니다. 회사에 소문이 나거나 가족들이 알게 될까 봐 걱정됐고, 특히 부모님이 예전에 보증 서주신 것 때문에 그 큰 빚이 부모님께 넘어가 불이익이 생길까 봐 제일 무서웠거든요.\n\n' +
      '그런데 직접 상담을 받아보니, 회생은 직장이나 가족에게 따로 통보되지 않아 조용히 진행할 수 있고 걱정했던 보증 부분도 제 상황에 맞춰 하나하나 짚어주셔서 막연한 불안이 싹 사라졌습니다.\n\n' +
      '덕분에 지금은 매달 43만 원 정도씩만 성실하게 갚아나가고 있습니다. 원금의 81%를 덜어내고 3년 동안 나누어 갚는 걸로 결정되니 일상이 참 많이 달라졌습니다. 예전처럼 밑 빠진 독에 물 붓듯 이자만 내는 게 아니라, 제 손으로 직접 원금을 줄여가고 있다는 생각이 드니 월급 관리도 안정적으로 변했고 가족들을 대할 때도 한결 마음이 편안해졌습니다.\n\n' +
      '제 어리석은 잘못으로 인생의 가장 밑바닥에 있을 때 도움을 주신 이정용 변호사님과 법률사무소 분들께 진심으로 감사드립니다.\n\n' +
      '혹시 지금 마음에 무거운 짐을 지고 제 후기를 읽고 계실 또 다른 분들이 있다면, 절대 스스로를 포기하지 마세요. 저 같은 사람도 기회를 얻어 다시 시작하고 있으니, 여러분도 분명히 다시 일어나실 수 있습니다.'

    },
    'review-8': {
      avatar: './img/avatar008.png',
      name: '장XX님',
      meta: '경기도 안산시',
      tags: ['사기피해'],
      photos: ['./img/tx_decision_LJY8.png', './img/tx-LJY-review8.png'],
      stars: 5,
      goodLabel: '채무 조정 결과',
      good: [
        '총 채무액: 448,670,880원',
        '탕감액: 426,237,336원',
        '월 변제금: 623,154원',
        '변제기간: 36개월'
      ],
      reviewLabel: '채무 경위와 회생 성공 수기',
      review:
      '지금도 그때를 떠올리면 억장이 무너지고 화가 치밀어 오릅니다. 처음엔 비상장 주식 리딩방에서 추천한 종목이 꽤 쏠쏠한 수익을 내더군요. VIP 특별 청약 물량을 배정받았으니 기회를 잡으라는 말에 속아, 카페 보증금 대출에 지인들 돈까지 끌어모아 이체하고 말았습니다.\n\n' +
      '그런데 하루아침에 담당자 연락이 끊기고 방이 폭파되더군요. 전부 사기였습니다. 순식간에 4억 4천8백만 원이라는 빚쟁이가 됐어요. 억울함에 매일 밤 술로 지새웠고, 빚 독촉 전화가 울릴 때마다 손발이 떨려 가게 문을 열어두고도 손님을 제대로 응대할 수 없을 만큼 망가졌습니다.\n\n' +
      '벼랑 끝에 선 심정으로 해결책을 찾다 이정용 변호사님을 알게 되었습니다. 하지만 사기로 전 재산을 잃고 나니 세상 사람에 대한 불신이 극에 달해 있었죠. 여기도 수임료만 받고 나 몰라라 하거나 무성의하게 처리하면 어쩌나 하는 두려움이 앞섰습니다.\n\n' +
      '그래도 지푸라기라도 잡는 심정으로 전화를 걸었는데, 제 헛된 걱정이었습니다. 사무장님께서 긴 시간 동안 제 억울한 사연을 본인 일처럼 공감하며 진심을 다해 상담해 주셨거든요. 당장 걱정했던 수임료 역시 제 팍팍한 사정에 맞춰 무리 없이 나누어 낼 수 있게 배려해 주신 덕분에 비로소 마음을 푹 놓았습니다.\n\n' +
      '글솜씨가 부족해 이 고마움을 온전히 담아내지 못하는 게 아쉽습니다. 변호사님 도움 덕분에 기적처럼 원금의 95%를 탕감받았습니다. 현재는 매달 62만 원 정도씩만 무리 없이 변제하고 있어요. 빚의 수렁에서 빠져나오니, 그제야 고생하는 아내 얼굴을 똑바로 마주 볼 수 있겠더군요. 사기 피해로 박살 났던 삶이 기적처럼 평온을 찾고 있습니다.\n\n' +
      '저처럼 사기 피해나 피치 못할 사정으로 억울하게 엄청난 빚을 떠안은 분이 있다면, 절대 혼자서 자책하며 무너지지 마세요. 홀로 갇혀 있으면 절망뿐이지만, 용기 내어 주위를 둘러보면 항상 도움의 손길을 내밀어 누군가가 곁에 있더라고요. 모두 힘내세요.'

    }

  };

  var track  = root.querySelector('.rv__track');
  var slides = Array.prototype.slice.call(root.querySelectorAll('.rv__slide'));
  var dots   = Array.prototype.slice.call(root.querySelectorAll('.rv__dot'));
  if (!track || !slides.length) return;

  /* ---------- 화면 크기별 한 번에 보이는 카드 수 ---------- */
  function visibleCount() {
    var w = window.innerWidth;
    if (w >= 1024) return 3;
    if (w >= 720)  return 2;
    return 1;
  }

  var index = 0;

  function maxIndex() {
    return Math.max(0, slides.length - visibleCount());
  }

  function slideWidth() {
    // 슬라이드 1장의 실제 폭(px) — CSS의 flex-basis(92% 등)와 padding이 그대로 반영됨
    return slides[0].getBoundingClientRect().width;
  }

  function applyTransform(extraPx) {
    var px = -(slideWidth() * index) + (extraPx || 0);
    track.style.transform = 'translateX(' + px + 'px)';
  }

  function goTo(i) {
    index = Math.min(Math.max(i, 0), maxIndex());
    applyTransform();
    dots.forEach(function (d, di) {
      d.setAttribute('aria-selected', di === index ? 'true' : 'false');
    });
    if (typeof updateArrows === 'function') updateArrows();
  }

  dots.forEach(function (d, di) { d.addEventListener('click', function () { goTo(di); }); });
  window.addEventListener('resize', function () { goTo(index); });

  /* ---------- 좌우 버튼으로만 넘기기 (터치 스와이프 없음) ---------- */
  var btnPrev = root.querySelector('[data-rv-prev]');
  var btnNext = root.querySelector('[data-rv-next]');

  function updateArrows() {
    if (btnPrev) btnPrev.disabled = (index <= 0);
    if (btnNext) btnNext.disabled = (index >= maxIndex());
  }

  if (btnPrev) btnPrev.addEventListener('click', function () { goTo(index - 1); });
  if (btnNext) btnNext.addEventListener('click', function () { goTo(index + 1); });

  updateArrows();

  /* ---------- 이미지 라이트박스 (팝업보다 위 레이어, 전역 1개) ---------- */
  var lightbox = document.querySelector('[data-lightbox]');
  var openLightbox = function () {};

  if (lightbox) {
    var lbImg = lightbox.querySelector('[data-lightbox-img]');

  var scrollY = 0;

  openLightbox = function (src, alt) {
    lbImg.src = src;
    lbImg.alt = alt || '';
    lightbox.hidden = false;

    scrollY = window.scrollY;
    document.body.style.top = '-' + scrollY + 'px';
    document.body.classList.add('rv-lightbox-locked');
  };

  function closeLightbox() {
    lightbox.hidden = true;
    lbImg.src = '';

    document.body.classList.remove('rv-lightbox-locked');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
  }

    lightbox.querySelectorAll('[data-lightbox-close]').forEach(function (el) {
      el.addEventListener('click', closeLightbox);
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
  }

  /* ---------- 상세 팝업 ---------- */
  var modal = document.querySelector('[data-review-modal]');
  var openModal = function () {};

  if (modal) {
    var elAvatar      = modal.querySelector('[data-modal-avatar]');
    var elName        = modal.querySelector('[data-modal-name]');
    var elMeta        = modal.querySelector('[data-modal-meta]');
    var elTags        = modal.querySelector('[data-modal-tags]');
    var elPhotos      = modal.querySelector('[data-modal-photos]'); // 카드와 동일한 사진 2장 영역
    var elGoodLabel   = modal.querySelector('[data-modal-good-label]');
    var elGood        = modal.querySelector('[data-modal-good]');
    var elReviewLabel = modal.querySelector('[data-modal-review-label]');
    var elReview      = modal.querySelector('[data-modal-review]');
    var elPhotosWrap = modal.querySelector('.rv-modal__photosWrap');
    var elModalBox = modal.querySelector('.rv-modal__box');
    var elPhotoDots  = modal.querySelector('[data-modal-photo-dots]');
    var btnPhotoPrev = modal.querySelector('[data-photo-prev]');
    var btnPhotoNext = modal.querySelector('[data-photo-next]');
    var photoIndex = 0;

    // 1) 함수 시작 전에 변수 하나 추가
    var modalScrollY = 0;

    // ★ 추가
    function goToPhoto(i, total) {
      photoIndex = Math.min(Math.max(i, 0), total - 1);
      var slot = elPhotos.children[photoIndex];
      if (slot) slot.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      updatePhotoDots();
    }

    function updatePhotoDots() {
      var dots = elPhotoDots.querySelectorAll('[role="tab"]');
      dots.forEach(function (d, di) {
        d.setAttribute('aria-selected', di === photoIndex ? 'true' : 'false');
      });
    }

    openModal = function (id) {
      var d = REVIEW_DATA[id];
      if (!d) return;

      elAvatar.src = d.avatar;
      elAvatar.alt = d.name;
      elName.textContent = d.name;
      elMeta.textContent = d.meta;

      elTags.innerHTML = '';
      d.tags.forEach(function (t) {
        var span = document.createElement('span');
        span.className = 'rv__tag';
        span.textContent = t;
        elTags.appendChild(span);
      });

      /* 카드와 동일한 사진, 클릭 시 라이트박스 확대 */
      elPhotos.innerHTML = '';
      elPhotoDots.innerHTML = '';
      photoIndex = 0;

      d.photos.forEach(function (src, i) {
        var slot = document.createElement('div');
        slot.className = 'rv-modal__photoSlot';

        var img = document.createElement('img');
        img.className = 'rv-modal__photo';
        img.src = src;
        img.alt = d.name;
        img.addEventListener('click', function () {
          openLightbox(src, d.name);
        });

        slot.appendChild(img);
        elPhotos.appendChild(slot);

        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'rv-modal__photoDot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        dot.addEventListener('click', function () { goToPhoto(i, d.photos.length); });
        elPhotoDots.appendChild(dot);
      });

      // ★ 사진 다 추가된 뒤 맨 첫 사진으로 즉시 리셋 (애니메이션 없이)
      elPhotos.scrollLeft = 0;
      photoIndex = 0;
      updatePhotoDots();

      var multi = d.photos.length > 1;
      btnPhotoPrev.hidden = !multi;
      btnPhotoNext.hidden = !multi;
      elPhotoDots.style.display = multi ? 'flex' : 'none';

      btnPhotoPrev.onclick = function () { goToPhoto(photoIndex - 1, d.photos.length); };
      btnPhotoNext.onclick = function () { goToPhoto(photoIndex + 1, d.photos.length); };

      elGoodLabel.textContent = d.goodLabel;
      elGood.innerHTML = '';
      d.good.forEach(function (g) {
        var li = document.createElement('li');
        li.textContent = g;
        elGood.appendChild(li);
      });

      elReviewLabel.textContent = d.reviewLabel;
      elReview.textContent = d.review;

      modal.hidden = false;

      // ★ 다음 프레임에 스크롤 리셋 (애니메이션/렌더 타이밍 이슈 회피)
      requestAnimationFrame(function () {
        elModalBox.scrollTop = 0;
        elPhotos.scrollLeft = 0;
      });

      modalScrollY = window.scrollY;
      document.body.style.top = '-' + modalScrollY + 'px';
      document.body.classList.add('rv-locked');
    };
    // open modal 맨 끝

    function closeModal() {
      var y = modalScrollY;                          // 위치 먼저 기억
      document.body.classList.remove('rv-locked');
      document.body.style.top = '';
      window.scrollTo(0, y);
      modal.hidden = true;                           // 스크롤 복원 후 맨 마지막에 숨김
    }

    modal.querySelectorAll('[data-review-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden && lightbox && lightbox.hidden) closeModal();
    });
  }

  /* 카드 전체 클릭 + "자세히 읽기" 버튼 클릭 모두 팝업 오픈*/
  slides.forEach(function (slide) {
    slide.addEventListener('click', function (e) {
      openModal(slide.id);
    });
  });

  /* 카드 요약문을 REVIEW_DATA에서 자동 생성 */
  slides.forEach(function (slide) {
    var d = REVIEW_DATA[slide.id];
    if (!d) return;
    var excerptEl = slide.querySelector('[data-excerpt]');
    if (!excerptEl) return;
    excerptEl.textContent = d.review;   // review 원문 통째로 넣고, CSS의 max-height+mask로 잘려 보이게
  });

  /* 카드 안 태그를 REVIEW_DATA에서 자동으로 채움 */
  slides.forEach(function (slide) {
    var d = REVIEW_DATA[slide.id];
    if (!d) return;
    var tagsEl = slide.querySelector('[data-card-tags]');
    if (!tagsEl) return;
    tagsEl.innerHTML = '';
    d.tags.forEach(function (t) {
      var span = document.createElement('span');
      span.className = 'rv__tag';
      span.textContent = t;
      tagsEl.appendChild(span);
    });
  });

  goTo(0);
})();