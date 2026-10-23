import assert from "node:assert/strict";
import test from "node:test";
import { calculateTemperature } from "./temperature.js";

test("factual questions use a lower temperature", () => {
  assert.equal(calculateTemperature("Who is Elon Musk?"), 0.35);
});

test("creative prompts use a higher temperature", () => {
  assert.equal(calculateTemperature("Write a short story about the ocean."), 0.78);
});

test("long questions receive a small temperature adjustment", () => {
  const question = `Explain this carefully ${"with useful details ".repeat(12)}`;
  assert.equal(calculateTemperature(question), 0.3);
});

test("temperature stays within the supported range", () => {
  assert.ok(calculateTemperature("Write a creative story") <= 0.9);
  assert.ok(calculateTemperature("What is this?") >= 0.15);
});
