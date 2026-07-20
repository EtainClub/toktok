import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const principlePage = await readFile(
  new URL("../app/principle/page.tsx", import.meta.url),
  "utf8",
);

test("the complete senior-friendly flow is represented", () => {
  for (const screen of [
    "welcome",
    "setup",
    "camera",
    "sensor",
    "target",
    "countdown",
    "exercise",
    "complete",
    "finished",
  ]) {
    assert.match(page, new RegExp(`"${screen}"`));
  }
});

test("camera and real motion-sensor paths are implemented", () => {
  assert.match(page, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(page, /DeviceMotionEvent/);
  assert.match(page, /requestPermission/);
  assert.match(page, /addEventListener\("devicemotion"/);
  assert.match(page, /LinearAccelerationSensor/);
  assert.match(page, /Accelerometer/);
  assert.match(page, /allowsFeature\("accelerometer"\)/);
  assert.match(page, /현재 앱 안의 미리보기에서는 가속도 센서가 차단돼 있어요/);
  assert.match(page, /5초 동안 가속도 값이 오지 않았어요/);
  assert.match(page, /analyzeMotionSample/);
  assert.match(page, /휴대폰 센서로 톡톡 감지하기/);
  assert.match(page, /폰을 쥔 손을 3번 톡톡해 주세요/);
  assert.match(page, /카메라를 열지 못했어요/);
});

test("target finding is separated from tapping", () => {
  assert.match(page, /빨간 점의 위치를 찾아주세요/);
  assert.match(page, /빨간 점 위치를 찾았어요/);
  assert.match(page, /빨간 점을 \{currentTarget\.count\}번 톡톡하세요/);
});

test("the experience exposes explicit pause, repeat, and next actions", () => {
  assert.match(page, /잠깐 멈추기/);
  assert.match(page, /계속하기/);
  assert.match(page, /다음 타점으로 가기/);
  assert.match(page, /이 단계 다시 하기/);
  assert.match(page, /자동으로 넘어가지 않아요/);
});

test("Korean speech, large text, focus, motion, and large tap targets are supported", () => {
  assert.match(page, /SpeechSynthesisUtterance/);
  assert.match(page, /const KOREAN_TTS_LANGUAGE = "ko-KR"/);
  assert.match(page, /utterance\.lang = KOREAN_TTS_LANGUAGE/);
  assert.match(page, /findKoreanVoice/);
  assert.match(page, /addEventListener\("voiceschanged"/);
  assert.match(page, /글자를 더 크게 보기/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height: 66px/);
});

test("the BRT principle page is easy to find, understand, and use safely", () => {
  assert.match(page, /href="\/principle"/);
  assert.match(principlePage, /자극 → 신호 → 반응/);
  assert.match(principlePage, /불편한 쪽과 반대쪽 팔을 안내해요/);
  assert.match(principlePage, /아프지 않게 일정한 리듬으로 두드리는 것/);
  assert.match(principlePage, /몸이나 뇌를 실제로 초기화한다는 뜻은 아니에요/);
  assert.match(principlePage, /의료 치료를 대신하지 않아요/);
  assert.match(principlePage, /현재 받고 있는 치료나 약을 임의로 중단하지 마세요/);
  assert.match(css, /\.principle-card-grid/);
});

test("a named detection seam remains available for a future vision model", () => {
  assert.match(page, /const registerDetectedHit/);
});

test("motion mode only counts a detected impact instead of an automatic timer", () => {
  assert.match(page, /if \(detectionMode !== "vision"\) return/);
  assert.match(
    page,
    /screen === "exercise" && isRunning[\s\S]*registerDetectedHit\(\)/,
  );
  assert.match(page, /실제 톡톡 충격이 휴대폰에\s*전달될 때만 한 번씩 셉니다/);
});

test("motion sensitivity can be adjusted and remembered", () => {
  assert.match(page, /type MotionSensitivity/);
  assert.match(page, /센서 민감도/);
  assert.match(page, /중복·오감지를 줄여요/);
  assert.match(page, /약한 톡톡도 감지해요/);
  assert.match(page, /toktok-motion-sensitivity/);
  assert.match(page, /applyMotionSensitivity/);
  assert.match(page, /onPointerDownCapture/);
  assert.match(page, /setIsRunning\(false\)/);
  assert.match(css, /\.sensitivity-options button\.is-selected/);
});
