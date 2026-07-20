import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "톡톡 타격법의 원리 | 천천히 톡톡",
  description:
    "팔을 가볍게 톡톡 두드리는 BRT의 원리와 올바른 자극 방법을 쉬운 한국어로 설명합니다.",
};

const signalSteps = [
  {
    number: "1",
    title: "팔에 가벼운 자극",
    description: "손끝을 모아 화면이 알려 주는 지점을 부드럽게 톡톡 두드려요.",
  },
  {
    number: "2",
    title: "감각 신호가 전달됨",
    description: "피부와 신경이 자극을 감지하고 그 정보를 뇌로 전달해요.",
  },
  {
    number: "3",
    title: "뇌와 몸이 반응",
    description: "원문은 이 반응이 몸의 균형 회복을 돕는다고 설명해요.",
  },
];

const principleCards = [
  {
    label: "왜 팔을 두드리나요?",
    title: "팔을 ‘신호를 보내는 곳’으로 봐요",
    description:
      "원문은 팔꿈치부터 손끝 사이에 약 200개의 ‘헬스 포인트’가 있다고 설명합니다. 이 지점을 자극해 뇌에 몸의 상태를 알리는 것이 BRT의 출발점이에요.",
  },
  {
    label: "왜 반대쪽 팔인가요?",
    title: "몸과 뇌의 교차 관계를 따르는 원칙이에요",
    description:
      "원문은 왼쪽 몸의 불편함에는 오른팔을, 오른쪽 몸의 불편함에는 왼팔을 자극하는 원칙을 제시합니다. 이 앱도 그 안내 원칙을 반영했어요.",
  },
  {
    label: "왜 가볍게 두드리나요?",
    title: "힘보다 리듬과 넓은 접촉이 중요해요",
    description:
      "다섯 손끝을 모으면 동전만큼 넓은 면적에 자극이 닿습니다. 손목의 탄력을 이용해 가볍게 두드리고, 아프거나 피부가 붉어질 만큼 세게 치지 않아요.",
  },
  {
    label: "‘리셋’은 무슨 뜻인가요?",
    title: "원리를 이해하기 위한 비유예요",
    description:
      "원문은 컴퓨터를 다시 시작하는 모습에 빗대어 몸이 균형을 찾는 과정을 ‘리셋’이라고 부릅니다. 몸이나 뇌를 실제로 초기화한다는 뜻은 아니에요.",
  },
];

const techniqueTips = [
  {
    number: "01",
    title: "다섯 손끝을 한데 모아요",
    description: "달걀을 가볍게 쥔 것처럼 손가락을 둥글게 모아 접촉 면적을 넓혀요.",
  },
  {
    number: "02",
    title: "손목의 탄력으로 톡톡",
    description: "손가락으로 찍어 치지 말고, 문을 가볍게 노크하듯 손목을 부드럽게 움직여요.",
  },
  {
    number: "03",
    title: "서두르지 않고 일정하게",
    description: "처음에는 1초에 약 2회 정도를 기준으로 천천히 리듬을 익혀요.",
  },
  {
    number: "04",
    title: "불편한 신호가 오면 멈춰요",
    description: "통증, 붉어짐, 멍, 어지러움이 느껴지면 강한 자극이므로 바로 중단해요.",
  },
];

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="천천히 톡톡 처음 화면으로 돌아가기">
      <span className="brand__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand__text">
        <strong>천천히 톡톡</strong>
        <small>어깨 편안 연습</small>
      </span>
    </Link>
  );
}

export default function PrinciplePage() {
  return (
    <div className="app-shell principle-shell">
      <a className="skip-link" href="#principle-content">
        본문으로 바로가기
      </a>

      <header className="topbar principle-topbar">
        <Brand />
        <Link className="principle-back-link" href="/">
          <span aria-hidden="true">←</span>
          연습 화면으로 돌아가기
        </Link>
      </header>

      <main id="principle-content" className="principle-page" tabIndex={-1}>
        <section className="principle-hero" aria-labelledby="principle-title">
          <div className="principle-hero__copy">
            <div className="welcome__badge">
              <span aria-hidden="true">♥</span>
              원리를 알면 더 안심할 수 있어요
            </div>
            <p className="eyebrow">톡톡 타격법의 원리</p>
            <h1 id="principle-title">
              가벼운 <em>톡톡</em>이
              <br />
              몸에 보내는 신호
            </h1>
            <p className="principle-hero__intro">
              BRT(Brain Reset Therapy) 설명 자료에서는 팔의 특정 지점을 가볍게
              자극해 뇌와 몸에 신호를 전달한다고 설명합니다. 핵심은 세게 치는 것이
              아니라, <strong>아프지 않게 일정한 리듬으로 두드리는 것</strong>이에요.
            </p>
            <a className="principle-jump-link" href="#easy-principle">
              3단계로 쉽게 보기
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="signal-visual" aria-label="톡톡 자극이 전달되는 세 단계">
            <div className="signal-visual__heading">
              <span>자료가 설명하는 흐름</span>
              <strong>자극 → 신호 → 반응</strong>
            </div>
            <ol>
              {signalSteps.map((step) => (
                <li key={step.number}>
                  <span className="signal-step__number">{step.number}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="signal-visual__caption">
              <span aria-hidden="true">i</span>
              ‘뇌 리셋’은 원문이 원리를 설명하기 위해 사용하는 비유입니다.
            </p>
          </div>
        </section>

        <section id="easy-principle" className="principle-section" aria-labelledby="easy-title">
          <div className="principle-section__heading">
            <p className="eyebrow">한눈에 이해하기</p>
            <h2 id="easy-title">네 가지 질문으로 보는 원리</h2>
            <p>어려운 표현은 덜고, 이 앱을 사용할 때 필요한 내용만 골랐어요.</p>
          </div>
          <div className="principle-card-grid">
            {principleCards.map((card, index) => (
              <article key={card.label} className="principle-card">
                <span className="principle-card__index">0{index + 1}</span>
                <p>{card.label}</p>
                <h3>{card.title}</h3>
                <div className="principle-card__line" aria-hidden="true" />
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cross-guide" aria-labelledby="cross-title">
          <div className="cross-guide__copy">
            <p className="eyebrow">이 앱의 팔 선택 원칙</p>
            <h2 id="cross-title">불편한 쪽과 반대쪽 팔을 안내해요</h2>
            <p>
              원문이 제시하는 몸과 뇌의 교차 관계에 따라, 이 앱은 불편한 어깨의
              반대쪽 팔을 연습 팔로 선택합니다.
            </p>
          </div>
          <div className="cross-guide__diagram" aria-label="불편한 어깨와 연습 팔의 관계">
            <div>
              <span>왼쪽 어깨가 불편</span>
              <strong>오른팔로 연습</strong>
            </div>
            <span className="cross-guide__arrow" aria-hidden="true">⇄</span>
            <div>
              <span>오른쪽 어깨가 불편</span>
              <strong>왼팔로 연습</strong>
            </div>
          </div>
        </section>

        <section className="principle-section technique-section" aria-labelledby="technique-title">
          <div className="principle-section__heading">
            <p className="eyebrow">이렇게 두드려요</p>
            <h2 id="technique-title">효과보다 먼저, 안전한 자극</h2>
            <p>‘톡톡’이라는 이름처럼 가볍고 편안해야 올바른 방법입니다.</p>
          </div>
          <ol className="technique-list">
            {techniqueTips.map((tip) => (
              <li key={tip.number}>
                <span>{tip.number}</span>
                <div>
                  <h3>{tip.title}</h3>
                  <p>{tip.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="scope-note">
            <span aria-hidden="true">✓</span>
            <p>
              <strong>이 앱은 ‘톡톡 두드리기’를 익히는 안내용 체험입니다.</strong>
              원문이 설명하는 전체 BRT에는 두드리기 뒤 특정 지점을 누르는 과정도
              포함되며, 화면의 타점과 횟수는 UI 체험용 예시입니다.
            </p>
          </div>
        </section>

        <aside className="evidence-note" aria-labelledby="evidence-title">
          <div className="evidence-note__icon" aria-hidden="true">i</div>
          <div>
            <p className="eyebrow">건강 정보로서 꼭 알아두세요</p>
            <h2 id="evidence-title">보완적 건강법은 의료 치료를 대신하지 않아요</h2>
            <p>
              이 페이지는 제공된 BRT 자료의 관점을 쉽게 풀어쓴 안내입니다. ‘헬스
              포인트’와 ‘뇌 리셋’이라는 설명은 특정 질환의 치료 효과나 작동 원리가
              현대 의학적으로 확립되었다는 뜻이 아닙니다.
            </p>
            <ul>
              <li>현재 받고 있는 치료나 약을 임의로 중단하지 마세요.</li>
              <li>심한 통증이 있거나 증상이 계속되면 연습보다 진료를 먼저 받으세요.</li>
              <li>임신 중이거나 질환이 있다면 시작 전에 의료진과 상의하세요.</li>
            </ul>
            <a
              href="https://www.nccih.nih.gov/health/are-you-considering-a-complementary-health-approach"
              target="_blank"
              rel="noreferrer"
            >
              보완적 건강 접근법의 안전 정보 보기
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </aside>

        <section className="principle-cta" aria-labelledby="cta-title">
          <p className="eyebrow">이제 직접 따라 해 볼까요?</p>
          <h2 id="cta-title">가볍게, 천천히, 내 몸의 신호를 살피면서</h2>
          <p>원리를 기억하면 화면의 안내를 더 편안하게 따라갈 수 있어요.</p>
          <Link className="primary-button" href="/">
            원리를 알았어요. 연습 시작하기
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>

      <footer className="principle-footer">
        <p>출처: 앱에 제공된 BRT 원리 설명 자료를 쉽게 재구성했습니다.</p>
        <Link href="/">천천히 톡톡 처음 화면</Link>
      </footer>
    </div>
  );
}
