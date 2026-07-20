import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

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

test("speech, large text, focus, motion, and large tap targets are supported", () => {
  assert.match(page, /SpeechSynthesisUtterance/);
  assert.match(page, /글자를 더 크게 보기/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height: 66px/);
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
