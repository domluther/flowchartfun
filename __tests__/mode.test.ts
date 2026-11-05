import { parseMode, withMode } from "../app/lib/mode";

it.each([
  ["draw", "draw"],
  ["shapes", "shapes"],
  [null, "guided"],
  ["invalid", "guided"],
])("parses mode %s", (value, expected) => {
  expect(parseMode(value)).toBe(expected);
});

it.each([
  ["guided", "/level/1"],
  ["draw", "/level/1?mode=draw"],
  ["shapes", "/level/1?mode=shapes"],
] as const)("builds the URL for %s mode", (mode, expected) => {
  expect(withMode("/level/1", mode)).toBe(expected);
});
