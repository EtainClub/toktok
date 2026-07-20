export type RoutineKey = "shoulder" | "waist";
export type HandView = "palm" | "back" | "edge";
export type TapIntensity = "강하게" | "부드럽게" | "부드럽고 천천히";

export type ProtocolItem = {
  id: number;
  point: string;
  description: string;
  detail: string;
  count: number;
  intensity: TapIntensity;
  view: HandView;
  x: number;
  y: number;
};

export type BrtProtocol = {
  key: RoutineKey;
  name: string;
  subject: string;
  condition: string;
  description: string;
  steps: ProtocolItem[];
  finish: {
    points: [string, string];
    seconds: number;
    repetitions: number;
  };
};

const step = (
  id: number,
  point: string,
  count: number,
  intensity: TapIntensity,
  view: HandView,
  x: number,
  y: number,
  description: string,
  detail: string,
): ProtocolItem => ({
  id,
  point,
  count,
  intensity,
  view,
  x,
  y,
  description,
  detail,
});

export const brtProtocols: Record<RoutineKey, BrtProtocol> = {
  shoulder: {
    key: "shoulder",
    name: "어깨 톡톡",
    subject: "어깨",
    condition: "어깨가 아플 때",
    description: "어깨가 불편할 때 따라 하는 5개 지점",
    steps: [
      step(1, "A1", 11, "강하게", "palm", 150, 420, "손바닥을 펴고 A1을 찾으세요.", "팔꿈치에 가까운 아래팔 중앙이에요."),
      step(2, "S2", 9, "강하게", "edge", 150, 400, "손을 옆으로 하고 S2를 찾으세요.", "팔꿈치에 가까운 아래팔 옆면이에요."),
      step(3, "P2", 7, "부드럽게", "palm", 171, 156, "손바닥 위쪽의 P2를 찾으세요.", "가운데손가락과 약손가락이 이어지는 곳이에요."),
      step(4, "D13", 13, "부드럽고 천천히", "back", 152, 410, "손등이 보이게 하고 D13을 찾으세요.", "팔꿈치에 가까운 아래팔 중앙이에요."),
      step(5, "H1", 11, "강하게", "back", 150, 174, "손등 중앙의 H1을 찾으세요.", "가운데손가락과 약손가락이 이어지는 곳이에요."),
    ],
    finish: { points: ["D13", "H1"], seconds: 3, repetitions: 3 },
  },
  waist: {
    key: "waist",
    name: "허리 톡톡",
    subject: "허리",
    condition: "앞으로 숙일 때 허리가 아플 때",
    description: "앞으로 숙일 때 불편하면 따라 하는 10개 지점",
    steps: [
      step(1, "A1", 11, "강하게", "palm", 150, 420, "손바닥을 펴고 A1을 찾으세요.", "팔꿈치에 가까운 아래팔 중앙이에요."),
      step(2, "A2", 9, "강하게", "palm", 150, 355, "A1 위의 A2를 찾으세요.", "A1과 A3 사이에 있어요."),
      step(3, "A3", 7, "부드럽게", "palm", 150, 295, "아래팔 중앙의 A3을 찾으세요.", "A2와 A4 사이에 있어요."),
      step(4, "A4", 13, "부드럽고 천천히", "palm", 150, 245, "손바닥 아래의 A4를 찾으세요.", "손목 주름 바로 아래에 있어요."),
      step(5, "P1", 11, "강하게", "palm", 150, 204, "손바닥 아래의 P1을 찾으세요.", "손목 주름 바로 위에 있어요."),
      step(6, "P5", 9, "강하게", "palm", 188, 196, "P1 옆의 P5를 찾으세요.", "P1에서 새끼손가락 쪽에 있어요."),
      step(7, "P4", 7, "부드럽게", "palm", 93, 171, "손바닥 옆의 P4를 찾으세요.", "P3보다 손목에 가까워요."),
      step(8, "P3", 13, "부드럽고 천천히", "palm", 93, 143, "P4 위의 P3을 찾으세요.", "손바닥 가장자리에 있어요."),
      step(9, "D5", 11, "강하게", "back", 150, 272, "손등이 보이게 하고 D5를 찾으세요.", "손목에서 조금 내려온 곳이에요."),
      step(10, "H12", 9, "강하게", "back", 150, 187, "손등 아래의 H12를 찾으세요.", "손목 주름 바로 위에 있어요."),
    ],
    finish: { points: ["P1", "P3"], seconds: 3, repetitions: 3 },
  },
};
