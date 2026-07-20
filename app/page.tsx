"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CALIBRATION_MOTION_CONFIG,
  DEFAULT_MOTION_CONFIG,
  analyzeMotionSample,
  applyMotionSensitivity,
  createCalibratedMotionConfig,
  createMotionDetectorState,
  type MotionDetectorConfig,
  type MotionSensitivity,
} from "../lib/motionDetection";

type PainSide = "left" | "right";
type ArmSide = "left" | "right";
type Screen =
  | "welcome"
  | "setup"
  | "camera"
  | "sensor"
  | "target"
  | "countdown"
  | "exercise"
  | "complete"
  | "finished";
type CameraStatus = "idle" | "requesting" | "ready" | "failed";
type DetectionMode = "vision" | "motion" | "manual";
type SensorStep = "intro" | "requesting" | "calibrating" | "ready" | "error";
type SensorSource =
  | "devicemotion"
  | "linear-acceleration"
  | "accelerometer"
  | null;
type DeviceMotionEventConstructorWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<PermissionState>;
};
type GenericMotionSensor = EventTarget & {
  x: number | null;
  y: number | null;
  z: number | null;
  start: () => void;
  stop: () => void;
};
type GenericMotionSensorConstructor = new (options?: {
  frequency?: number;
  referenceFrame?: "device" | "screen";
}) => GenericMotionSensor;
type WindowWithMotionSensors = Window & {
  Accelerometer?: GenericMotionSensorConstructor;
  LinearAccelerationSensor?: GenericMotionSensorConstructor;
};
type SensorPermissionsPolicy = {
  allowsFeature: (feature: string) => boolean;
};
type DocumentWithSensorPolicy = Document & {
  featurePolicy?: SensorPermissionsPolicy;
  permissionsPolicy?: SensorPermissionsPolicy;
};

type ProtocolItem = {
  id: number;
  label: string;
  shortLabel: string;
  description: string;
  detail: string;
  count: number;
  targetY: number;
};

const KOREAN_TTS_LANGUAGE = "ko-KR";

function findKoreanVoice(voices: SpeechSynthesisVoice[]) {
  const exactLanguage = KOREAN_TTS_LANGUAGE.toLowerCase();

  return (
    voices.find(
      (voice) => voice.lang.replace("_", "-").toLowerCase() === exactLanguage,
    ) ??
    voices.find((voice) => {
      const language = voice.lang.replace("_", "-").toLowerCase();
      return language === "ko" || language.startsWith("ko-");
    }) ??
    null
  );
}

const protocol: ProtocolItem[] = [
  {
    id: 1,
    label: "첫 번째 연습 타점",
    shortLabel: "팔 위쪽",
    description: "팔꿈치와 어깨 사이, 바깥쪽의 빨간 점을 찾아주세요.",
    detail: "손가락으로 빨간 원 주변을 천천히 짚어 보세요.",
    count: 20,
    targetY: 0.32,
  },
  {
    id: 2,
    label: "두 번째 연습 타점",
    shortLabel: "팔꿈치 아래",
    description: "팔꿈치 바로 아래, 바깥쪽의 빨간 점을 찾아주세요.",
    detail: "팔꿈치 뼈를 먼저 찾은 뒤 손목 방향으로 조금 내려가세요.",
    count: 15,
    targetY: 0.55,
  },
  {
    id: 3,
    label: "세 번째 연습 타점",
    shortLabel: "손목 위쪽",
    description: "손목에서 조금 올라온 바깥쪽의 빨간 점을 찾아주세요.",
    detail: "손목 주름을 찾은 뒤 팔꿈치 방향으로 조금 올라가세요.",
    count: 10,
    targetY: 0.77,
  },
];

const setupSteps = [
  {
    eyebrow: "준비 1 · 휴대폰 놓기",
    title: "휴대폰을 세워 놓아 주세요",
    description:
      "두 손을 편하게 쓸 수 있도록 책이나 컵에 기대어 세워 주세요.",
  },
  {
    eyebrow: "준비 2 · 위치 맞추기",
    title: "팔꿈치와 손목이 보이게 앉아 주세요",
    description:
      "휴대폰에서 한 걸음 정도 떨어져 앉고, 안내할 팔을 화면 안에 놓아 주세요.",
  },
];

const stageLabels = ["팔 선택", "준비", "타점 찾기", "톡톡하기"];

function sideName(side: ArmSide) {
  return side === "left" ? "왼팔" : "오른팔";
}

function painSideName(side: PainSide) {
  return side === "left" ? "왼쪽 어깨" : "오른쪽 어깨";
}

function sensorSourceName(source: SensorSource) {
  if (source === "devicemotion") return "브라우저 동작 센서";
  if (source === "linear-acceleration") return "선형 가속도 센서";
  if (source === "accelerometer") return "가속도 센서";
  return "센서 자동 선택";
}

const motionSensitivityOptions: Array<{
  value: MotionSensitivity;
  label: string;
  description: string;
  badge?: string;
}> = [
  {
    value: "low",
    label: "낮음",
    description: "중복·오감지를 줄여요",
  },
  {
    value: "normal",
    label: "보통",
    description: "대부분에게 알맞아요",
    badge: "권장",
  },
  {
    value: "high",
    label: "높음",
    description: "약한 톡톡도 감지해요",
  },
];

function motionSensitivityName(sensitivity: MotionSensitivity) {
  return motionSensitivityOptions.find((option) => option.value === sensitivity)!
    .label;
}

function MotionSensitivityControl({
  value,
  onChange,
  compact = false,
}: {
  value: MotionSensitivity;
  onChange: (value: MotionSensitivity) => void;
  compact?: boolean;
}) {
  return (
    <fieldset
      className={`sensitivity-control ${compact ? "sensitivity-control--compact" : ""}`}
    >
      <legend>센서 민감도</legend>
      {!compact && (
        <p>
          한 번이 두 번으로 잡히거나 가만히 있어도 올라가면 <strong>낮음</strong>,
          약한 톡톡이 잘 안 잡히면 <strong>높음</strong>을 선택하세요.
        </p>
      )}
      <div className="sensitivity-options">
        {motionSensitivityOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "is-selected" : ""}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span>
              <strong>{option.label}</strong>
              {option.badge && <em>{option.badge}</em>}
            </span>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function currentStage(screen: Screen) {
  if (screen === "welcome") return 0;
  if (screen === "setup" || screen === "camera" || screen === "sensor") return 1;
  if (screen === "target") return 2;
  return 3;
}

function Icon({
  name,
  size = 24,
}: {
  name:
    | "help"
    | "sound"
    | "text"
    | "home"
    | "camera"
    | "phone"
    | "check"
    | "pause"
    | "play"
    | "repeat"
    | "arrow";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<string, React.ReactNode> = {
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.3 2.3 0 0 1 4.4.9c0 1.8-2.2 2-2.2 3.7" />
        <path d="M12 17.4h.01" />
      </>
    ),
    sound: (
      <>
        <path d="M4 10v4h3l4 3V7l-4 3H4Z" />
        <path d="M15 9.3a4 4 0 0 1 0 5.4" />
        <path d="M18 6.8a7.3 7.3 0 0 1 0 10.4" />
      </>
    ),
    text: (
      <>
        <path d="M4 6V4h16v2" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    camera: (
      <>
        <path d="M4 7h3l1.5-2h7L17 7h3v12H4Z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    phone: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M10 5h4" />
        <path d="M11.7 18.7h.6" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.7 2.7L16.5 9" />
      </>
    ),
    pause: (
      <>
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    repeat: (
      <>
        <path d="M19 7v5h-5" />
        <path d="M5.4 17A8 8 0 0 0 19 12" />
        <path d="M5 12H1V7" />
        <path d="M5 12a8 8 0 0 1 13.6-5" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function ArmGuide({
  arm,
  targetY,
  tapping = false,
  compact = false,
}: {
  arm: ArmSide;
  targetY: number;
  tapping?: boolean;
  compact?: boolean;
}) {
  const isLeft = arm === "left";
  const armX = isLeft ? 101 : 259;
  const dotY = 102 + targetY * 202;
  const handX = isLeft ? 148 : 212;
  const handRotation = isLeft ? -18 : 18;

  return (
    <div
      className={`arm-guide ${compact ? "arm-guide--compact" : ""}`}
      aria-label={`${sideName(arm)}의 ${Math.round(
        targetY * 100,
      )}% 지점에 빨간 타점이 표시된 그림`}
    >
      <svg
        viewBox="0 0 360 420"
        role="img"
        aria-hidden="true"
        className="body-map"
      >
        <defs>
          <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1f4f5b" />
            <stop offset="1" stopColor="#173b46" />
          </linearGradient>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="7" stdDeviation="7" floodOpacity=".14" />
          </filter>
        </defs>

        <circle cx="180" cy="54" r="38" fill="#f2caaa" />
        <path
          d="M143 52c3-26 17-39 38-39 22 0 36 15 37 38-13-5-25-13-34-24-10 14-24 22-41 25Z"
          fill="#26393f"
        />
        <path
          d="M153 92c-31 7-44 29-43 66l10 113c2 20 14 31 31 31h58c17 0 29-11 31-31l10-113c1-37-12-59-43-66Z"
          fill="url(#shirt)"
          filter="url(#softShadow)"
        />
        <path
          d="M144 99c-19 4-31 16-36 35l-17 76-5 111c-1 17 7 28 21 29 14 1 24-9 25-26l8-106 25-89Z"
          fill={isLeft ? "#f2b680" : "#f2caaa"}
          stroke={isLeft ? "#d06a36" : "#d4a27c"}
          strokeWidth={isLeft ? 6 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M216 99c19 4 31 16 36 35l17 76 5 111c1 17-7 28-21 29-14 1-24-9-25-26l-8-106-25-89Z"
          fill={!isLeft ? "#f2b680" : "#f2caaa"}
          stroke={!isLeft ? "#d06a36" : "#d4a27c"}
          strokeWidth={!isLeft ? 6 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M158 301v88" stroke="#203f49" strokeWidth="34" strokeLinecap="round" />
        <path d="M202 301v88" stroke="#203f49" strokeWidth="34" strokeLinecap="round" />

        <g className="target-marker" transform={`translate(${armX} ${dotY})`}>
          <circle r="31" fill="#dd403a" opacity=".14" className="target-pulse" />
          <circle r="21" fill="#fff" stroke="#b9292f" strokeWidth="4" />
          <circle r="13" fill="#dd403a" />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontSize="11"
            fontWeight="900"
            fill="#fff"
          >
            여기
          </text>
        </g>

        {tapping && (
          <g
            className="tapping-hand"
            transform={`translate(${handX} ${dotY - 18}) rotate(${handRotation})`}
          >
            <path
              d="M-7 10C-22 2-28-12-21-19c5-5 12 0 16 7l5 8-1-42c0-9 12-9 13 0l2 27 2-24c1-8 12-7 12 1v25l3-18c2-7 12-5 11 3l-2 31c-1 17-10 29-24 32-8 2-17-4-23-21Z"
              fill="#f6d4bb"
              stroke="#8b5f4a"
              strokeWidth="2"
            />
            <path d="M-27-11c-12 0-20 5-24 14" stroke="#dd403a" strokeWidth="4" strokeLinecap="round" />
            <path d="M-25-22c-12-4-20-2-27 5" stroke="#dd403a" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
      </svg>
      <div className="arm-label">
        <span className="arm-label__dot" aria-hidden="true" />
        안내할 팔 · <strong>{sideName(arm)}</strong>
      </div>
    </div>
  );
}

function PhoneSetupVisual({ step }: { step: number }) {
  return (
    <div className="setup-visual" aria-hidden="true">
      <div className="setup-blob setup-blob--one" />
      <div className="setup-blob setup-blob--two" />
      {step === 0 ? (
        <div className="phone-scene">
          <div className="phone-device">
            <div className="phone-device__speaker" />
            <div className="phone-device__screen">
              <span>천천히</span>
              <strong>톡톡</strong>
            </div>
          </div>
          <div className="phone-stand" />
          <div className="book book--one" />
          <div className="book book--two" />
          <div className="success-tag">
            <Icon name="check" size={20} /> 두 손이 자유로워요
          </div>
        </div>
      ) : (
        <div className="distance-scene">
          <div className="mini-phone">
            <Icon name="camera" size={28} />
          </div>
          <div className="distance-line">
            <span />
            <strong>한 걸음</strong>
            <span />
          </div>
          <div className="seated-person">
            <span className="seated-person__head" />
            <span className="seated-person__body" />
            <span className="seated-person__arm" />
            <span className="seated-person__chair" />
          </div>
          <div className="frame-cue">팔꿈치부터 손목까지</div>
        </div>
      )}
    </div>
  );
}

function SensorSetupVisual({
  arm,
  sensorStep,
  signalLevel,
}: {
  arm: ArmSide;
  sensorStep: SensorStep;
  signalLevel: number;
}) {
  const isActive = sensorStep === "calibrating" || sensorStep === "ready";

  return (
    <div className="sensor-visual" aria-hidden="true">
      <div className="sensor-visual__halo" />
      <svg className="sensor-hand-illustration" viewBox="0 0 430 520">
        <defs>
          <linearGradient id="sensorPhone" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#244f5a" />
            <stop offset="1" stopColor="#102f38" />
          </linearGradient>
          <filter id="sensorShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="15" stdDeviation="14" floodOpacity=".18" />
          </filter>
        </defs>
        <g filter="url(#sensorShadow)">
          <rect x="154" y="69" width="151" height="292" rx="28" fill="url(#sensorPhone)" />
          <rect x="168" y="88" width="123" height="239" rx="18" fill="#eff7f3" />
          <rect x="202" y="78" width="55" height="7" rx="4" fill="#81979b" />
          <circle cx="229" cy="342" r="8" fill="#dcece5" />
          <g transform="translate(229 198)">
            <circle r="60" fill="#dcece5" />
            <path
              d="M-30 8c8-32 48-32 60 0"
              fill="none"
              stroke="#2e7775"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="-20" cy="-17" r="6" fill="#183e49" />
            <circle cx="20" cy="-17" r="6" fill="#183e49" />
            <text x="0" y="85" textAnchor="middle" fill="#183e49" fontSize="16" fontWeight="900">
              센서 준비
            </text>
          </g>
        </g>

        <path
          d="M112 405c-9-43 5-102 39-127 18-13 34 0 27 18l-12 30 17-61c4-15 23-11 20 4l-11 57 20-70c4-15 24-10 20 6l-16 67 23-57c6-14 24-5 18 10l-24 65 21-33c9-13 25 0 17 13l-34 56c-16 27-45 48-73 48-28 0-46-17-52-46Z"
          fill="#f2caaa"
          stroke="#9d684e"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M303 287c25-7 54 4 66 25 9 16 3 34-15 37-16 2-28-12-43-16-12-4-28-2-38-10-13-10-6-30 30-36Z"
          fill="#f2caaa"
          stroke="#9d684e"
          strokeWidth="3"
        />
        <path
          d="M337 273c19-16 39-17 56-6"
          fill="none"
          stroke="#dd403a"
          strokeWidth="6"
          strokeLinecap="round"
          className={isActive ? "sensor-tap-wave" : ""}
        />
        <path
          d="M325 249c24-22 51-27 78-16"
          fill="none"
          stroke="#dd403a"
          strokeWidth="5"
          strokeLinecap="round"
          className={isActive ? "sensor-tap-wave sensor-tap-wave--delay" : ""}
        />
      </svg>
      <div className="sensor-hold-label">
        <Icon name="phone" size={22} />
        <span>
          <small>휴대폰을 쥘 손</small>
          <strong>{sideName(arm)}</strong>
        </span>
      </div>
      <div className="sensor-visual__signal">
        <span>센서 반응</span>
        <i>
          <b style={{ width: `${signalLevel}%` }} />
        </i>
        <strong>{isActive ? "감지 중" : "준비 전"}</strong>
      </div>
    </div>
  );
}

function ProgressHeader({
  screen,
  onHelp,
}: {
  screen: Screen;
  onHelp: () => void;
}) {
  const activeStage = currentStage(screen);

  return (
    <header className="topbar">
      <button
        className="brand"
        type="button"
        onClick={() => window.location.reload()}
        aria-label="천천히 톡톡 처음 화면으로 돌아가기"
      >
        <span className="brand__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="brand__text">
          <strong>천천히 톡톡</strong>
          <small>어깨 편안 연습</small>
        </span>
      </button>

      <ol className="stage-list" aria-label="전체 진행 단계">
        {stageLabels.map((label, index) => (
          <li
            key={label}
            className={`${index === activeStage ? "is-active" : ""} ${
              index < activeStage ? "is-done" : ""
            }`}
            aria-current={index === activeStage ? "step" : undefined}
          >
            <span>{index < activeStage ? "✓" : index + 1}</span>
            <em>{label}</em>
          </li>
        ))}
      </ol>

      <button className="help-button" type="button" onClick={onHelp}>
        <Icon name="help" size={25} />
        <span>도움말·설정</span>
      </button>
    </header>
  );
}

function HelpPanel({
  open,
  onClose,
  onSpeak,
  largeText,
  onToggleText,
  motionSensitivity,
  onMotionSensitivityChange,
  onHome,
}: {
  open: boolean;
  onClose: () => void;
  onSpeak: () => void;
  largeText: boolean;
  onToggleText: () => void;
  motionSensitivity: MotionSensitivity;
  onMotionSensitivityChange: (value: MotionSensitivity) => void;
  onHome: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="help-panel__header">
          <div>
            <p className="eyebrow">언제든 같은 자리에서</p>
            <h2 id="help-title">도움말과 설정</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose}>
            닫기
          </button>
        </div>
        <MotionSensitivityControl
          value={motionSensitivity}
          onChange={onMotionSensitivityChange}
        />
        <div className="help-actions">
          <button type="button" onClick={onSpeak}>
            <Icon name="sound" />
            <span>
              <strong>현재 설명 다시 듣기</strong>
              <small>지금 화면의 안내를 음성으로 들려드려요</small>
            </span>
          </button>
          <button type="button" onClick={onToggleText}>
            <Icon name="text" />
            <span>
              <strong>{largeText ? "기본 글씨로 보기" : "글자를 더 크게 보기"}</strong>
              <small>
                {largeText
                  ? "처음 크기의 글씨로 돌아가요"
                  : "본문과 버튼 글씨를 한 단계 키워요"}
              </small>
            </span>
          </button>
          <button type="button" onClick={onHome}>
            <Icon name="home" />
            <span>
              <strong>처음 화면으로 돌아가기</strong>
              <small>현재 연습을 끝내고 팔 선택부터 다시 시작해요</small>
            </span>
          </button>
        </div>
        <p className="keyboard-tip">키보드에서는 Tab 키로 버튼을 이동할 수 있어요.</p>
      </section>
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <span aria-hidden="true">i</span>
      <p>
        화면의 타점과 횟수는 <strong>UI 체험용 예시</strong>이며 의료 안내가 아닙니다.
        아프거나 어지러우면 바로 멈추세요.
      </p>
      <a href="/principle">톡톡 원리 알아보기 →</a>
    </footer>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [painSide, setPainSide] = useState<PainSide | null>(null);
  const [workingArm, setWorkingArm] = useState<ArmSide>("left");
  const [setupIndex, setSetupIndex] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("vision");
  const [sensorStep, setSensorStep] = useState<SensorStep>("intro");
  const [sensorCalibrationCount, setSensorCalibrationCount] = useState(0);
  const [sensorSignalLevel, setSensorSignalLevel] = useState(0);
  const [sensorHasSignal, setSensorHasSignal] = useState(false);
  const [sensorMessage, setSensorMessage] = useState("");
  const [sensorSource, setSensorSource] = useState<SensorSource>(null);
  const [sensorConfig, setSensorConfig] =
    useState<MotionDetectorConfig>(DEFAULT_MOTION_CONFIG);
  const [motionSensitivity, setMotionSensitivity] =
    useState<MotionSensitivity>("normal");
  const [targetIndex, setTargetIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [isRunning, setIsRunning] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const exerciseStartRef = useRef<number | null>(null);
  const motionStateRef = useRef(createMotionDetectorState());
  const calibrationPeaksRef = useRef<number[]>([]);
  const lastSignalPaintRef = useRef(0);
  const signalDecayTimerRef = useRef<number | null>(null);
  const sensorHasSignalRef = useRef(false);
  const sensorSourceRef = useRef<SensorSource>(null);
  const genericSensorRef = useRef<GenericMotionSensor | null>(null);
  const ignoreMotionUntilRef = useRef(0);
  const koreanVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const currentTarget = protocol[targetIndex];
  const activeMotionConfig = useMemo(
    () => applyMotionSensitivity(sensorConfig, motionSensitivity),
    [motionSensitivity, sensorConfig],
  );

  const instruction = useMemo(() => {
    if (screen === "welcome")
      return "먼저 불편한 어깨를 골라 주세요. 선택한 쪽의 반대편 팔로 연습을 안내합니다.";
    if (screen === "setup") return setupSteps[setupIndex].description;
    if (screen === "camera") {
      if (cameraStatus === "ready")
        return "카메라가 준비되었습니다. 팔꿈치와 손목이 화면 안에 보이면 계속해 주세요.";
      if (cameraStatus === "failed")
        return "카메라를 사용할 수 없습니다. 휴대폰 센서로 톡톡 감지하기를 누르면 계속할 수 있습니다.";
      return "카메라로 팔 위치를 확인하거나, 휴대폰 센서로 실제 톡톡을 감지할 수 있습니다.";
    }
    if (screen === "sensor") {
      if (sensorStep === "calibrating")
        return `휴대폰을 ${sideName(workingArm)}의 손에 쥐고, 다른 손으로 폰을 쥔 손을 세 번 가볍게 톡톡하세요. 현재 ${sensorCalibrationCount}번 감지했습니다.`;
      if (sensorStep === "ready")
        return "센서 준비가 끝났습니다. 실제 연습에서는 톡톡 충격이 감지될 때만 횟수가 올라갑니다.";
      if (sensorStep === "error")
        return "이 기기에서 움직임 센서를 사용할 수 없습니다. 다시 시도하거나 카메라 감지로 돌아갈 수 있습니다.";
      return `휴대폰을 ${sideName(workingArm)}의 손에 단단히 쥐어 주세요. 다음 화면에서 센서 반응을 세 번 맞춥니다.`;
    }
    if (screen === "target")
      return `${currentTarget.description} 찾은 뒤 빨간 점 위치를 찾았어요 버튼을 눌러 주세요.`;
    if (screen === "countdown")
      return `${countdown}초 뒤 톡톡 연습을 시작합니다.`;
    if (screen === "exercise")
      return `${currentTarget.label}을 ${currentTarget.count}번 톡톡합니다. 현재 ${count}번 확인했습니다.`;
    if (screen === "complete")
      return `${currentTarget.count}회를 모두 확인했습니다. 다음 타점으로 가거나 이 단계를 다시 할 수 있습니다.`;
    return "오늘의 연습을 모두 마쳤습니다. 수고하셨습니다.";
  }, [
    cameraStatus,
    count,
    countdown,
    currentTarget,
    screen,
    sensorCalibrationCount,
    sensorStep,
    setupIndex,
    workingArm,
  ]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const speak = useCallback(
    (message = instruction) => {
      if (!("speechSynthesis" in window)) {
        setSpeechMessage("이 브라우저에서는 음성 안내를 사용할 수 없어요.");
        return;
      }
      const speechSynthesis = window.speechSynthesis;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = KOREAN_TTS_LANGUAGE;
      utterance.rate = 0.82;
      utterance.pitch = 1;
      const koreanVoice =
        koreanVoiceRef.current ?? findKoreanVoice(speechSynthesis.getVoices());
      if (koreanVoice) {
        koreanVoiceRef.current = koreanVoice;
        utterance.voice = koreanVoice;
      }
      utterance.onstart = () => setSpeechMessage("설명을 읽고 있어요.");
      utterance.onend = () => setSpeechMessage("");
      utterance.onerror = () =>
        setSpeechMessage("음성 안내를 재생하지 못했어요. 화면의 글을 확인해 주세요.");
      speechSynthesis.speak(utterance);
    },
    [instruction],
  );

  const playBeat = useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const context =
        audioContextRef.current || new AudioContextClass({ latencyHint: "interactive" });
      audioContextRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 540;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.1);
    } catch {
      // Sound is an enhancement; the visible count remains authoritative.
    }
  }, []);

  const registerDetectedHit = useCallback(() => {
    setCount((previous) => {
      if (previous >= currentTarget.count) return previous;
      const next = previous + 1;
      playBeat();
      navigator.vibrate?.(35);
      return next;
    });
  }, [currentTarget.count, playBeat]);

  const changeMotionSensitivity = useCallback(
    (nextSensitivity: MotionSensitivity) => {
      setMotionSensitivity(nextSensitivity);
      motionStateRef.current = createMotionDetectorState();
      ignoreMotionUntilRef.current = performance.now() + 900;
      try {
        window.localStorage.setItem(
          "toktok-motion-sensitivity",
          nextSensitivity,
        );
      } catch {
        // The selected value still applies for this session.
      }

      if (detectionMode === "motion") {
        setSensorMessage(
          `센서 민감도를 ${motionSensitivityName(nextSensitivity)}으로 바꿨어요.`,
        );
        if (screen === "exercise") setIsRunning(false);
      }
    },
    [detectionMode, screen],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("toktok-motion-sensitivity");
      if (stored === "low" || stored === "normal" || stored === "high") {
        setMotionSensitivity(stored);
      }
    } catch {
      // Storage is optional; "normal" remains the safe default.
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (screen !== "countdown") return;
    setCountdown(3);
    const timer = window.setInterval(() => {
      setCountdown((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          setScreen("exercise");
          setIsRunning(true);
          exerciseStartRef.current = Date.now();
          return 1;
        }
        return previous - 1;
      });
    }, reducedMotion ? 650 : 1000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, screen]);

  useEffect(() => {
    if (screen !== "exercise" || !isRunning) return;
    if (count >= currentTarget.count) {
      setIsRunning(false);
      setScreen("complete");
      navigator.vibrate?.([80, 70, 120]);
      return;
    }
    if (detectionMode !== "vision") return;
    const timer = window.setTimeout(registerDetectedHit, reducedMotion ? 650 : 920);
    return () => window.clearTimeout(timer);
  }, [
    count,
    currentTarget.count,
    detectionMode,
    isRunning,
    reducedMotion,
    registerDetectedHit,
    screen,
  ]);

  useEffect(() => {
    const sensorIsListening =
      detectionMode === "motion" &&
      (sensorStep === "calibrating" || sensorStep === "ready");
    if (!sensorIsListening) return;

    let disposed = false;
    let fallbackTimer: number | null = null;
    let noSignalTimer: number | null = null;
    const genericWindow = window as WindowWithMotionSensors;

    const handleMotionSample = (
      sample: Parameters<typeof analyzeMotionSample>[1],
      source: Exclude<SensorSource, null>,
    ) => {
      if (
        disposed ||
        (sensorSourceRef.current !== null &&
          sensorSourceRef.current !== source)
      ) {
        return;
      }

      const activeConfig =
        sensorStep === "calibrating"
          ? CALIBRATION_MOTION_CONFIG
          : activeMotionConfig;
      const analysis = analyzeMotionSample(
        motionStateRef.current,
        sample,
        activeConfig,
      );
      motionStateRef.current = analysis.state;

      if (analysis.source === "unavailable") {
        return;
      }

      if (!sensorHasSignalRef.current) {
        sensorHasSignalRef.current = true;
        sensorSourceRef.current = source;
        setSensorHasSignal(true);
        setSensorSource(source);
        setSensorMessage(
          `${sensorSourceName(source)} 값을 받고 있어요. 평소 세기로 톡톡해 주세요.`,
        );
      }

      const now = performance.now();
      if (now - lastSignalPaintRef.current >= 70) {
        lastSignalPaintRef.current = now;
        const level = Math.min(
          100,
          Math.round((analysis.magnitude / Math.max(activeConfig.hitThreshold, 0.1)) * 72),
        );
        setSensorSignalLevel(level);
        if (signalDecayTimerRef.current !== null) {
          window.clearTimeout(signalDecayTimerRef.current);
        }
        signalDecayTimerRef.current = window.setTimeout(
          () => setSensorSignalLevel(0),
          180,
        );
      }

      if (
        !analysis.hit ||
        performance.now() < ignoreMotionUntilRef.current
      ) {
        return;
      }

      if (sensorStep === "calibrating") {
        if (calibrationPeaksRef.current.length >= 3) return;
        calibrationPeaksRef.current.push(analysis.magnitude);
        const nextCount = calibrationPeaksRef.current.length;
        setSensorCalibrationCount(nextCount);
        playBeat();
        navigator.vibrate?.(45);

        if (nextCount === 3) {
          setSensorConfig(
            createCalibratedMotionConfig(calibrationPeaksRef.current),
          );
          setSensorStep("ready");
          setSensorMessage("세 번의 톡톡을 확인했어요. 센서를 이 손에 맞췄습니다.");
          navigator.vibrate?.([70, 60, 100]);
        }
        return;
      }

      if (screen === "exercise" && isRunning) {
        registerDetectedHit();
      }
    };

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      handleMotionSample(
        {
          acceleration: event.acceleration
            ? {
                x: event.acceleration.x,
                y: event.acceleration.y,
                z: event.acceleration.z,
              }
            : null,
          accelerationIncludingGravity: event.accelerationIncludingGravity
            ? {
                x: event.accelerationIncludingGravity.x,
                y: event.accelerationIncludingGravity.y,
                z: event.accelerationIncludingGravity.z,
              }
            : null,
          timestamp: event.timeStamp || performance.now(),
        },
        "devicemotion",
      );
    };

    const startGenericSensor = () => {
      if (
        disposed ||
        genericSensorRef.current ||
        (sensorSourceRef.current !== null &&
          sensorSourceRef.current !== "linear-acceleration" &&
          sensorSourceRef.current !== "accelerometer")
      ) {
        return;
      }

      const GenericSensorConstructor =
        genericWindow.LinearAccelerationSensor || genericWindow.Accelerometer;
      if (!GenericSensorConstructor) return;
      const source: Exclude<SensorSource, null> =
        genericWindow.LinearAccelerationSensor
          ? "linear-acceleration"
          : "accelerometer";

      try {
        const sensor = new GenericSensorConstructor({
          frequency: 60,
          referenceFrame: "device",
        });
        genericSensorRef.current = sensor;
        sensor.addEventListener("reading", () => {
          const vector = { x: sensor.x, y: sensor.y, z: sensor.z };
          handleMotionSample(
            {
              acceleration: source === "linear-acceleration" ? vector : null,
              accelerationIncludingGravity:
                source === "accelerometer" ? vector : null,
              timestamp: performance.now(),
            },
            source,
          );
        });
        sensor.addEventListener("error", () => {
          if (!sensorHasSignalRef.current) {
            setSensorMessage(
              "가속도 센서 접근이 차단됐어요. 휴대폰의 Safari 또는 Chrome에서 직접 열어 주세요.",
            );
          }
        });
        sensor.start();
      } catch {
        genericSensorRef.current = null;
      }
    };

    window.addEventListener("devicemotion", handleDeviceMotion);

    if (
      sensorSourceRef.current === "linear-acceleration" ||
      sensorSourceRef.current === "accelerometer" ||
      !("DeviceMotionEvent" in window)
    ) {
      startGenericSensor();
    } else {
      fallbackTimer = window.setTimeout(startGenericSensor, 1600);
    }

    noSignalTimer = window.setTimeout(() => {
      if (disposed || sensorHasSignalRef.current) return;
      setSensorStep("error");
      setSensorMessage(
        "5초 동안 가속도 값이 오지 않았어요. 메신저 안의 브라우저를 닫고 Safari 또는 Chrome에서 이 주소를 직접 열어 주세요.",
      );
    }, 5000);

    return () => {
      disposed = true;
      window.removeEventListener("devicemotion", handleDeviceMotion);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (noSignalTimer !== null) window.clearTimeout(noSignalTimer);
      genericSensorRef.current?.stop();
      genericSensorRef.current = null;
    };
  }, [
    detectionMode,
    isRunning,
    playBeat,
    registerDetectedHit,
    screen,
    activeMotionConfig,
    sensorStep,
  ]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const speechSynthesis = window.speechSynthesis;
    const loadKoreanVoice = () => {
      koreanVoiceRef.current = findKoreanVoice(speechSynthesis.getVoices());
    };

    loadKoreanVoice();
    speechSynthesis.addEventListener("voiceschanged", loadKoreanVoice);

    return () => {
      speechSynthesis.removeEventListener("voiceschanged", loadKoreanVoice);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      window.speechSynthesis?.cancel();
      if (signalDecayTimerRef.current !== null) {
        window.clearTimeout(signalDecayTimerRef.current);
      }
    };
  }, [stopCamera]);

  const choosePainSide = (side: PainSide) => {
    const guideArm = side === "left" ? "right" : "left";
    setPainSide(side);
    setWorkingArm(guideArm);
    setSetupIndex(0);
    setDetectionMode("vision");
    setSensorStep("intro");
    setSensorCalibrationCount(0);
    setSensorSignalLevel(0);
    setSensorHasSignal(false);
    sensorHasSignalRef.current = false;
    setSensorSource(null);
    sensorSourceRef.current = null;
    setSensorMessage("");
    setSensorConfig(DEFAULT_MOTION_CONFIG);
    motionStateRef.current = createMotionDetectorState();
    calibrationPeaksRef.current = [];
    setScreen("setup");
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  const requestCamera = async () => {
    setCameraStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus("ready");
    } catch {
      setCameraStatus("failed");
    }
  };

  const enterVisionTarget = () => {
    setDetectionMode("vision");
    setScreen("target");
  };

  const startSensorPath = () => {
    stopCamera();
    setDetectionMode("motion");
    setSensorStep("intro");
    setSensorCalibrationCount(0);
    setSensorSignalLevel(0);
    setSensorHasSignal(false);
    sensorHasSignalRef.current = false;
    setSensorSource(null);
    sensorSourceRef.current = null;
    setSensorMessage("");
    setSensorConfig(DEFAULT_MOTION_CONFIG);
    motionStateRef.current = createMotionDetectorState();
    calibrationPeaksRef.current = [];
    setScreen("sensor");
  };

  const requestMotionAccess = async () => {
    playBeat();
    setSensorStep("requesting");
    setSensorMessage("");

    if (!window.isSecureContext) {
      setSensorStep("error");
      setSensorMessage("움직임 센서는 보안 연결(HTTPS)에서만 사용할 수 있어요.");
      return;
    }

    const sensorPolicyDocument = document as DocumentWithSensorPolicy;
    const sensorPolicy =
      sensorPolicyDocument.permissionsPolicy ||
      sensorPolicyDocument.featurePolicy;
    if (sensorPolicy && !sensorPolicy.allowsFeature("accelerometer")) {
      setSensorStep("error");
      setSensorMessage(
        "현재 앱 안의 미리보기에서는 가속도 센서가 차단돼 있어요. 이 페이지를 Safari 또는 Chrome에서 직접 열어 주세요.",
      );
      return;
    }

    const motionWindow = window as WindowWithMotionSensors;
    const hasDeviceMotion = "DeviceMotionEvent" in window;
    const hasGenericMotionSensor =
      Boolean(motionWindow.LinearAccelerationSensor) ||
      Boolean(motionWindow.Accelerometer);

    if (!hasDeviceMotion && !hasGenericMotionSensor) {
      setSensorStep("error");
      setSensorMessage("이 기기나 브라우저에는 움직임 센서 기능이 없어요.");
      return;
    }

    try {
      let permission: PermissionState = "granted";
      if (hasDeviceMotion) {
        const MotionEventConstructor =
          window.DeviceMotionEvent as DeviceMotionEventConstructorWithPermission;
        permission = MotionEventConstructor.requestPermission
          ? await MotionEventConstructor.requestPermission()
          : "granted";
      }

      if (permission !== "granted") {
        setSensorStep("error");
        setSensorMessage(
          "움직임 센서 권한이 허용되지 않았어요. 브라우저 설정을 확인해 주세요.",
        );
        return;
      }

      motionStateRef.current = createMotionDetectorState();
      calibrationPeaksRef.current = [];
      setSensorCalibrationCount(0);
      setSensorSignalLevel(0);
      setSensorHasSignal(false);
      sensorHasSignalRef.current = false;
      setSensorSource(null);
      sensorSourceRef.current = null;
      setSensorConfig(DEFAULT_MOTION_CONFIG);
      setSensorMessage(
        "권한을 확인했어요. 센서 값이 들어오는지 최대 5초 동안 확인합니다.",
      );
      setSensorStep("calibrating");
    } catch {
      setSensorStep("error");
      setSensorMessage(
        "움직임 센서 권한을 열지 못했어요. 버튼을 눌러 다시 시도해 주세요.",
      );
    }
  };

  const restartSensorCalibration = () => {
    motionStateRef.current = createMotionDetectorState();
    calibrationPeaksRef.current = [];
    setSensorCalibrationCount(0);
    setSensorSignalLevel(0);
    setSensorHasSignal(false);
    sensorHasSignalRef.current = false;
    setSensorSource(null);
    sensorSourceRef.current = null;
    setSensorMessage("센서 값을 다시 확인하고 있어요. 잠시만 기다려 주세요.");
    setSensorStep("calibrating");
  };

  const enterSensorTarget = () => {
    if (sensorStep !== "ready") return;
    setDetectionMode("motion");
    setScreen("target");
  };

  const enterManualTarget = () => {
    stopCamera();
    setDetectionMode("manual");
    setScreen("target");
  };

  const startExercise = () => {
    setCount(0);
    setIsRunning(false);
    playBeat();
    setScreen("countdown");
  };

  const repeatStage = () => {
    setCount(0);
    setIsRunning(false);
    setScreen("target");
  };

  const nextStage = () => {
    setCount(0);
    setIsRunning(false);
    if (targetIndex >= protocol.length - 1) {
      stopCamera();
      setScreen("finished");
      return;
    }
    setTargetIndex((previous) => previous + 1);
    setScreen("target");
  };

  const resetApp = () => {
    stopCamera();
    window.speechSynthesis?.cancel();
    setScreen("welcome");
    setPainSide(null);
    setWorkingArm("left");
    setSetupIndex(0);
    setCameraStatus("idle");
    setDetectionMode("vision");
    setSensorStep("intro");
    setSensorCalibrationCount(0);
    setSensorSignalLevel(0);
    setSensorHasSignal(false);
    sensorHasSignalRef.current = false;
    setSensorSource(null);
    sensorSourceRef.current = null;
    setSensorMessage("");
    setSensorConfig(DEFAULT_MOTION_CONFIG);
    motionStateRef.current = createMotionDetectorState();
    calibrationPeaksRef.current = [];
    setTargetIndex(0);
    setCount(0);
    setIsRunning(false);
    setHelpOpen(false);
    setSpeechMessage("");
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  const renderWelcome = () => (
    <main className="welcome">
      <section className="welcome__copy">
        <div className="welcome__badge">
          <span aria-hidden="true">♥</span>
          혼자서도 천천히 따라 해요
        </div>
        <p className="eyebrow">오늘의 어깨 편안 연습</p>
        <h1>
          어느 쪽 어깨가
          <br />
          <em>불편하신가요?</em>
        </h1>
        <p className="welcome__intro">
          불편한 쪽을 고르면, 반대쪽 팔로 연습할 수 있도록 처음부터 끝까지
          안내해 드릴게요.
        </p>
        <div className="side-choice" aria-label="불편한 어깨 선택">
          <button type="button" onClick={() => choosePainSide("right")}>
            <span className="side-choice__letter" aria-hidden="true">R</span>
            <span>
              <strong>오른쪽 어깨가 불편해요</strong>
              <small>왼팔로 연습을 안내할게요</small>
            </span>
            <Icon name="arrow" size={28} />
          </button>
          <button type="button" onClick={() => choosePainSide("left")}>
            <span className="side-choice__letter" aria-hidden="true">L</span>
            <span>
              <strong>왼쪽 어깨가 불편해요</strong>
              <small>오른팔로 연습을 안내할게요</small>
            </span>
            <Icon name="arrow" size={28} />
          </button>
        </div>
        <div className="safety-note">
          <span aria-hidden="true">!</span>
          <p>
            <strong>몸이 보내는 신호를 먼저 살펴 주세요.</strong>
            통증이 심하거나 어지러우면 연습을 시작하지 마세요.
          </p>
        </div>
        <a className="principle-entry-link" href="/principle">
          왜 반대쪽 팔을 톡톡할까요? 원리부터 알아보기
          <span aria-hidden="true">→</span>
        </a>
      </section>

      <section className="welcome__visual" aria-label="톡톡 연습 안내 그림">
        <div className="visual-card">
          <div className="visual-card__top">
            <span>오늘도 가볍게</span>
            <strong>약 3분</strong>
          </div>
          <ArmGuide arm="left" targetY={0.4} tapping />
          <div className="visual-card__caption">
            <span>톡</span>
            <span>톡</span>
            <p>
              화면을 보며
              <br />
              <strong>내 속도대로</strong>
            </p>
          </div>
        </div>
        <div className="floating-card floating-card--sound">
          <Icon name="sound" size={23} />
          <span>
            <small>음성 안내</small>
            <strong>또박또박</strong>
          </span>
        </div>
        <div className="floating-card floating-card--count">
          <small>확인된 횟수</small>
          <strong>8 <span>/ 20회</span></strong>
          <i><b /></i>
        </div>
      </section>
    </main>
  );

  const renderSetup = () => {
    const step = setupSteps[setupIndex];
    return (
      <main className="screen-layout">
        <section className="screen-card screen-card--setup">
          <div className="screen-copy">
            <p className="eyebrow">{step.eyebrow}</p>
            <h1>{step.title}</h1>
            <p className="lead">{step.description}</p>
            <div className="arm-confirmation">
              <span>{sideName(workingArm).slice(0, 1)}</span>
              <p>
                <small>{painSide && painSideName(painSide)} 반대편</small>
                <strong>{sideName(workingArm)}을 안내할게요</strong>
              </p>
            </div>
            {setupIndex === 0 ? (
              <div className="step-tips">
                <span><b>1</b> 책이나 컵에 기대기</span>
                <span><b>2</b> 화면이 얼굴을 향하게 두기</span>
                <span><b>3</b> 두 손을 자유롭게 하기</span>
              </div>
            ) : (
              <div className="step-tips">
                <span><b>1</b> 휴대폰에서 한 걸음 떨어지기</span>
                <span><b>2</b> 등을 편하게 펴고 앉기</span>
                <span><b>3</b> {sideName(workingArm)} 전체가 보이게 하기</span>
              </div>
            )}
            <div className="button-stack">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (setupIndex === 0) setSetupIndex(1);
                  else setScreen("camera");
                }}
              >
                {setupIndex === 0
                  ? "휴대폰을 세워 놓았어요"
                  : "팔 위치를 맞췄어요"}
                <Icon name="arrow" />
              </button>
              <div className="choice-divider" aria-hidden="true">
                <span />
                또는
                <span />
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={startSensorPath}
              >
                <Icon name="phone" />
                휴대폰을 손에 쥐고 센서로 할게요
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  if (setupIndex > 0) setSetupIndex(0);
                  else resetApp();
                }}
              >
                {setupIndex > 0
                  ? "휴대폰 놓기 안내로 돌아가기"
                  : "어깨 선택을 다시 할게요"}
              </button>
            </div>
          </div>
          <PhoneSetupVisual step={setupIndex} />
        </section>
      </main>
    );
  };

  const renderCamera = () => (
    <main className="screen-layout">
      <section className="camera-grid">
        <div className="screen-copy">
          <p className="eyebrow">준비 3 · 카메라 확인</p>
          <h1>
            {cameraStatus === "ready"
              ? "팔이 화면 안에 잘 보이나요?"
              : "카메라로 위치를 확인할까요?"}
          </h1>
          <p className="lead">
            카메라는 팔 위치를 확인하는 데만 사용해요. 카메라를 쓰지 않을 때는
            휴대폰의 움직임 센서로 실제 톡톡 충격을 셀 수 있습니다.
          </p>
          <div className="privacy-note">
            <span aria-hidden="true">✓</span>
            <p>
              <strong>영상은 저장하지 않아요.</strong>
              이 기기 화면에서만 바로 보여 드립니다.
            </p>
          </div>
          <div className="button-stack">
            {cameraStatus === "idle" && (
              <button type="button" className="primary-button" onClick={requestCamera}>
                <Icon name="camera" />
                카메라로 팔 위치 확인하기
              </button>
            )}
            {cameraStatus === "requesting" && (
              <button type="button" className="primary-button" disabled>
                카메라 연결을 기다리고 있어요…
              </button>
            )}
            {cameraStatus === "ready" && (
              <button
                type="button"
                className="primary-button"
                onClick={enterVisionTarget}
              >
                팔꿈치와 손목이 잘 보여요
                <Icon name="arrow" />
              </button>
            )}
            {cameraStatus === "failed" && (
              <div className="camera-error" role="alert">
                <strong>카메라를 열지 못했어요.</strong>
                <span>괜찮아요. 휴대폰 센서로 실제 톡톡을 셀 수 있어요.</span>
              </div>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={startSensorPath}
            >
              <Icon name="phone" />
              휴대폰 센서로 톡톡 감지하기
            </button>
            {cameraStatus === "failed" && (
              <button type="button" className="text-button" onClick={requestCamera}>
                카메라 연결을 다시 시도할게요
              </button>
            )}
          </div>
        </div>
        <div className={`camera-preview camera-preview--${cameraStatus}`}>
          <video ref={videoRef} muted playsInline aria-label="카메라 미리보기" />
          {cameraStatus !== "ready" && (
            <div className="camera-placeholder">
              <div className="camera-placeholder__icon">
                <Icon name="camera" size={42} />
              </div>
              <strong>
                {cameraStatus === "requesting"
                  ? "카메라를 연결하고 있어요"
                  : cameraStatus === "failed"
                    ? "카메라 없이도 괜찮아요"
                    : "여기에 내 모습이 보여요"}
              </strong>
              <span>팔꿈치부터 손목까지 화면 안에 놓아 주세요</span>
            </div>
          )}
          {cameraStatus === "ready" && (
            <>
              <div className="camera-frame" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="camera-live">
                <i />
                카메라가 팔을 잘 보고 있어요
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );

  const renderSensor = () => (
    <main className="screen-layout">
      <section className="sensor-grid">
        <SensorSetupVisual
          arm={workingArm}
          sensorStep={sensorStep}
          signalLevel={sensorSignalLevel}
        />
        <div className="screen-copy sensor-copy">
          <p className="eyebrow">준비 4 · 움직임 센서 맞추기</p>
          {sensorStep === "intro" && (
            <>
              <h1>{sideName(workingArm)}의 손으로 휴대폰을 쥐어 주세요</h1>
              <p className="lead">
                다른 손으로 폰을 쥔 손을 톡톡하면, 휴대폰의 가속도 센서가 작은
                충격을 확인합니다.
              </p>
              <div className="sensor-howto">
                <span><b>1</b> 케이스가 미끄럽지 않게 단단히 잡기</span>
                <span><b>2</b> 팔과 손의 힘은 편하게 풀기</span>
                <span><b>3</b> 다른 손의 손가락 끝으로 가볍게 톡톡하기</span>
              </div>
              <div className="sensor-privacy-note">
                <Icon name="check" size={22} />
                <p>
                  <strong>센서 값은 저장하거나 전송하지 않아요.</strong>
                  이 화면에서 충격 여부를 계산하는 데만 사용합니다.
                </p>
              </div>
              <div className="button-stack">
                <button
                  type="button"
                  className="primary-button"
                  onClick={requestMotionAccess}
                >
                  <Icon name="phone" />
                  휴대폰을 쥐었어요. 센서 시작하기
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setDetectionMode("vision");
                    setScreen("camera");
                  }}
                >
                  카메라 확인으로 돌아갈게요
                </button>
              </div>
            </>
          )}

          {sensorStep === "requesting" && (
            <>
              <h1>센서 연결을 기다리고 있어요</h1>
              <p className="lead">
                권한 창이 보이면 움직임 및 방향 접근을 허용해 주세요.
              </p>
              <button type="button" className="primary-button" disabled>
                움직임 센서를 연결하고 있어요…
              </button>
            </>
          )}

          {sensorStep === "calibrating" && (
            <>
              <h1>폰을 쥔 손을 3번 톡톡해 주세요</h1>
              <p className="lead">
                평소 연습할 세기로 한 번씩 천천히 두드리면, 센서가 이 손에 맞는
                감지 세기를 정합니다.
              </p>
              <div className="calibration-count" aria-live="polite">
                {[0, 1, 2].map((index) => {
                  const checked = index < sensorCalibrationCount;
                  return (
                    <span key={index} className={checked ? "is-checked" : ""}>
                      {checked ? "✓" : index + 1}
                      <small>{checked ? "감지됨" : "기다림"}</small>
                    </span>
                  );
                })}
              </div>
              <div className="sensor-live-status">
                <i className={sensorHasSignal ? "is-live" : ""} />
                <p>
                  <strong>
                    {sensorHasSignal
                      ? "휴대폰 움직임을 읽고 있어요"
                      : "센서 신호를 기다리고 있어요"}
                  </strong>
                  <small>
                    {sensorMessage ||
                      "센서 값이 들어오는지 최대 5초 동안 확인하고 있어요."}
                  </small>
                </p>
              </div>
              <div className="sensor-diagnostics" aria-label="센서 연결 상태">
                <span className="is-ok">
                  <b>✓</b>
                  HTTPS 보안 연결
                </span>
                <span className={sensorHasSignal ? "is-ok" : "is-waiting"}>
                  <b>{sensorHasSignal ? "✓" : "…"}</b>
                  {sensorHasSignal ? "가속도 값 수신" : "가속도 값 확인 중"}
                </span>
                <span className={sensorSource ? "is-ok" : "is-waiting"}>
                  <b>{sensorSource ? "✓" : "…"}</b>
                  {sensorSourceName(sensorSource)}
                </span>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setDetectionMode("vision");
                  setScreen("camera");
                }}
              >
                센서 대신 카메라를 사용할게요
              </button>
            </>
          )}

          {sensorStep === "ready" && (
            <>
              <div className="sensor-ready-mark">
                <Icon name="check" size={45} />
              </div>
              <h1>센서 준비가 끝났어요</h1>
              <p className="lead">
                이제 자동으로 횟수를 올리지 않아요. 실제 톡톡 충격이 휴대폰에
                전달될 때만 한 번씩 셉니다.
              </p>
              <div className="sensor-ready-summary">
                <span>
                  <small>보정한 횟수</small>
                  <strong>{sensorCalibrationCount} / 3회</strong>
                </span>
                <span>
                  <small>휴대폰을 쥔 손</small>
                  <strong>{sideName(workingArm)}</strong>
                </span>
                <span>
                  <small>감지 방식</small>
                  <strong>{sensorSourceName(sensorSource)}</strong>
                </span>
                <span>
                  <small>센서 민감도</small>
                  <strong>{motionSensitivityName(motionSensitivity)}</strong>
                </span>
              </div>
              <MotionSensitivityControl
                value={motionSensitivity}
                onChange={changeMotionSensitivity}
              />
              <div className="button-stack">
                <button
                  type="button"
                  className="primary-button"
                  onClick={enterSensorTarget}
                >
                  센서로 톡톡 연습 시작하기
                  <Icon name="arrow" />
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={restartSensorCalibration}
                >
                  <Icon name="repeat" />
                  센서를 다시 맞출게요
                </button>
              </div>
            </>
          )}

          {sensorStep === "error" && (
            <>
              <h1>센서를 사용할 수 없어요</h1>
              <p className="lead" role="alert">
                {sensorMessage}
              </p>
              <ol className="sensor-error-help">
                <li>카카오톡·문자 앱 안에서 열었다면 메뉴에서 ‘Safari로 열기’ 또는 ‘Chrome으로 열기’를 선택해 주세요.</li>
                <li>센서 시작 버튼을 다시 누르고 움직임 권한 창에서 ‘허용’을 선택해 주세요.</li>
                <li>그래도 안 되면 화면 회전이 되는지 확인해 기기 센서 자체를 점검해 주세요.</li>
              </ol>
              <div className="button-stack">
                <button
                  type="button"
                  className="primary-button"
                  onClick={requestMotionAccess}
                >
                  센서 연결을 다시 시도할게요
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setDetectionMode("vision");
                    setScreen("camera");
                  }}
                >
                  <Icon name="camera" />
                  카메라 감지로 돌아가기
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={enterManualTarget}
                >
                  센서 없는 기기에서 직접 횟수를 기록할게요
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );

  const renderTarget = () => (
    <main className="screen-layout">
      <section className="task-grid">
        <div className="task-visual">
          <div className="task-step">
            <span>{targetIndex + 1}</span>
            {protocol.length}개 중 {targetIndex + 1}번째
          </div>
          <ArmGuide arm={workingArm} targetY={currentTarget.targetY} />
        </div>
        <div className="screen-copy task-copy">
          <p className="eyebrow">
            {detectionMode === "motion"
              ? "센서 감지"
              : detectionMode === "manual"
                ? "직접 기록"
                : "카메라 감지"}{" "}
            · {currentTarget.shortLabel}
          </p>
          <h1>빨간 점의 위치를 찾아주세요</h1>
          <p className="lead">{currentTarget.description}</p>
          <div className="location-note">
            <span className="location-note__target">여기</span>
            <p>
              <strong>{currentTarget.label}</strong>
              {currentTarget.detail}
            </p>
          </div>
          <div className="single-task-note">
            <span aria-hidden="true">1</span>
            <p>
              지금은 <strong>위치만 찾습니다.</strong>
              톡톡하기는 다음 화면에서 시작해요.
            </p>
          </div>
          {detectionMode === "motion" && (
            <div className="sensor-grip-reminder">
              <Icon name="phone" />
              <p>
                <strong>휴대폰은 {sideName(workingArm)}의 손에 계속 쥐어 주세요.</strong>
                빨간 점을 톡톡하면 충격이 팔을 타고 휴대폰 센서에 전달됩니다.
              </p>
            </div>
          )}
          {detectionMode === "manual" && (
            <div className="sensor-grip-reminder sensor-grip-reminder--manual">
              <Icon name="help" />
              <p>
                <strong>센서를 사용할 수 없는 기기입니다.</strong>
                다음 화면에서 실제로 한 번 톡톡할 때마다 기록 버튼을 눌러 주세요.
              </p>
            </div>
          )}
          <div className="button-stack">
            <button type="button" className="primary-button" onClick={startExercise}>
              빨간 점 위치를 찾았어요
              <Icon name="arrow" />
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => speak(`${currentTarget.description} ${currentTarget.detail}`)}
            >
              <Icon name="sound" />
              위치를 다시 설명해 주세요
            </button>
          </div>
        </div>
      </section>
    </main>
  );

  const renderCountdown = () => (
    <main className="screen-layout">
      <section className="countdown-card" aria-live="assertive">
        <div className="countdown-card__label">잠시 후 시작해요</div>
        <div className="countdown-card__number" key={countdown}>
          {countdown}
        </div>
        <h1>{countdown}초 뒤 톡톡 시작합니다</h1>
        <p>
          {detectionMode === "motion"
            ? `휴대폰을 ${sideName(workingArm)}의 손에 쥔 채, 다른 손을 빨간 점 가까이에 놓아 주세요.`
            : "두드릴 손을 빨간 점 가까이에 편하게 놓아 주세요."}
        </p>
        <div className="countdown-dots" aria-hidden="true">
          {[3, 2, 1].map((number) => (
            <span key={number} className={number >= countdown ? "is-filled" : ""} />
          ))}
        </div>
        <button
          type="button"
          className="secondary-button countdown-cancel"
          onClick={() => setScreen("target")}
        >
          위치를 다시 확인할게요
        </button>
      </section>
    </main>
  );

  const renderExercise = () => {
    const progress = Math.round((count / currentTarget.count) * 100);
    const runningTitle =
      detectionMode === "motion"
        ? "센서가 실제 톡톡을 확인하고 있어요"
        : detectionMode === "manual"
          ? "톡톡한 뒤 기록 버튼을 눌러 주세요"
          : "좋아요. 편한 속도로 계속하세요";
    const modeDescription =
      detectionMode === "motion"
        ? "가속도 센서가 충격을 감지하고 있어요"
        : detectionMode === "manual"
          ? "센서 없는 기기에서 직접 기록합니다"
          : "카메라가 팔을 잘 보고 있어요";

    return (
      <main className="screen-layout">
        <section className="exercise-grid">
          <div className="exercise-visual">
            <div className="mode-badge">
              <span aria-hidden="true" />
              {modeDescription}
            </div>
            <ArmGuide
              arm={workingArm}
              targetY={currentTarget.targetY}
              tapping={isRunning}
              compact
            />
          </div>
          <div className="exercise-panel">
            <p className="eyebrow">{currentTarget.label}</p>
            <h1>빨간 점을 {currentTarget.count}번 톡톡하세요</h1>
            <div className="count-display" aria-live="polite">
              <span>확인된 횟수</span>
              <strong>{count}</strong>
              <em>/ {currentTarget.count}회</em>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="톡톡 진행률"
              aria-valuemin={0}
              aria-valuemax={currentTarget.count}
              aria-valuenow={count}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            {detectionMode === "motion" && (
              <>
                <div className="exercise-sensor-meter">
                  <div>
                    <span>휴대폰 센서 반응</span>
                    <strong>{sensorHasSignal ? "실시간 감지 중" : "신호 기다리는 중"}</strong>
                  </div>
                  <i aria-label={`센서 반응 ${sensorSignalLevel}%`}>
                    <b style={{ width: `${sensorSignalLevel}%` }} />
                  </i>
                  <small>휴대폰을 든 손 전체를 크게 흔들면 정확도가 떨어질 수 있어요.</small>
                </div>
                <MotionSensitivityControl
                  value={motionSensitivity}
                  onChange={changeMotionSensitivity}
                  compact
                />
              </>
            )}
            <div className={`run-status ${isRunning ? "is-running" : "is-paused"}`}>
              <i aria-hidden="true" />
              <span>
                <strong>
                  {isRunning
                    ? runningTitle
                    : "멈춰 있습니다. 준비되면 계속하세요"}
                </strong>
                <small>
                  {isRunning ? `${progress}% 진행했어요` : "횟수는 그대로 저장되어 있어요"}
                </small>
              </span>
            </div>
            <div className="button-stack">
              {detectionMode === "manual" && isRunning ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={registerDetectedHit}
                >
                  <Icon name="check" />
                  한 번 톡톡했어요
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setIsRunning((previous) => !previous)}
                >
                  <Icon name={isRunning ? "pause" : "play"} />
                  {isRunning ? "잠깐 멈추기" : "계속하기"}
                </button>
              )}
              {detectionMode === "manual" && isRunning && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsRunning(false)}
                >
                  <Icon name="pause" />
                  잠깐 멈추기
                </button>
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => speak()}
              >
                <Icon name="sound" />
                설명을 다시 들을게요
              </button>
              {detectionMode === "motion" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setIsRunning(false);
                    setCount(0);
                    restartSensorCalibration();
                    setScreen("sensor");
                  }}
                >
                  센서 감도를 다시 맞출게요
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  };

  const renderComplete = () => {
    const hasNext = targetIndex < protocol.length - 1;
    return (
      <main className="screen-layout">
        <section className="complete-card">
          <div className="celebration" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <div className="complete-check"><Icon name="check" size={58} /></div>
          </div>
          <p className="eyebrow">{currentTarget.label} 완료</p>
          <h1>{currentTarget.count}회를 모두 확인했어요</h1>
          <p className="lead">
            서두르지 않아도 괜찮아요. 숨을 한 번 고르고 다음을 직접 골라 주세요.
          </p>
          <div className="complete-summary">
            <div>
              <span>완료 횟수</span>
              <strong>{count} / {currentTarget.count}회</strong>
            </div>
            <div>
              <span>연습한 팔</span>
              <strong>{sideName(workingArm)}</strong>
            </div>
          </div>
          <div className="button-stack button-stack--complete">
            <button type="button" className="primary-button" onClick={nextStage}>
              {hasNext ? "다음 타점으로 가기" : "오늘 연습 마치기"}
              <Icon name="arrow" />
            </button>
            <button type="button" className="secondary-button" onClick={repeatStage}>
              <Icon name="repeat" />
              이 단계 다시 하기
            </button>
          </div>
          <p className="no-auto-note">
            자동으로 넘어가지 않아요. 준비되었을 때 버튼을 눌러 주세요.
          </p>
        </section>
      </main>
    );
  };

  const renderFinished = () => (
    <main className="screen-layout">
      <section className="finished-card">
        <div className="finished-illustration" aria-hidden="true">
          <span className="sun-ray sun-ray--1" />
          <span className="sun-ray sun-ray--2" />
          <span className="sun-ray sun-ray--3" />
          <span className="sun-ray sun-ray--4" />
          <div className="finished-face">⌣</div>
          <div className="finished-hand finished-hand--left">♡</div>
          <div className="finished-hand finished-hand--right">♡</div>
        </div>
        <p className="eyebrow">오늘의 연습 완료</p>
        <h1>
          천천히, 아주 잘
          <br />
          따라오셨어요
        </h1>
        <p className="lead">
          {sideName(workingArm)}의 연습 타점 {protocol.length}곳을 모두 마쳤습니다.
          잠시 팔의 힘을 빼고 편하게 쉬어 주세요.
        </p>
        <div className="finished-stages" aria-label="완료한 연습">
          {protocol.map((item) => (
            <span key={item.id}>
              <Icon name="check" size={20} />
              {item.shortLabel} {item.count}회
            </span>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={resetApp}>
          <Icon name="repeat" />
          처음부터 다시 체험하기
        </button>
      </section>
    </main>
  );

  return (
    <div
      className={`app-shell ${largeText ? "large-text" : ""} ${
        reducedMotion ? "reduced-motion" : ""
      }`}
      onPointerDownCapture={() => {
        ignoreMotionUntilRef.current = performance.now() + 650;
      }}
    >
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <div id="main-content" tabIndex={-1}>
        <ProgressHeader screen={screen} onHelp={() => setHelpOpen(true)} />
        {screen === "welcome" && renderWelcome()}
        {screen === "setup" && renderSetup()}
        {screen === "camera" && renderCamera()}
        {screen === "sensor" && renderSensor()}
        {screen === "target" && renderTarget()}
        {screen === "countdown" && renderCountdown()}
        {screen === "exercise" && renderExercise()}
        {screen === "complete" && renderComplete()}
        {screen === "finished" && renderFinished()}
      </div>
      <AppFooter />
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onSpeak={() => speak()}
        largeText={largeText}
        onToggleText={() => setLargeText((previous) => !previous)}
        motionSensitivity={motionSensitivity}
        onMotionSensitivityChange={changeMotionSensitivity}
        onHome={resetApp}
      />
      <div className="sr-only" role="status" aria-live="polite">
        {speechMessage}
      </div>
    </div>
  );
}
