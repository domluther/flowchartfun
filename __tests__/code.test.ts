import { generateCode, generateERLURL } from "../app/lib/code";
import { levels } from "../app/lib/levels";

describe("generateCode", () => {
  it("produces code for every level", () => {
    for (const level of levels) {
      const { python, erl } = generateCode(level);
      expect(python.length).toBeGreaterThan(0);
      expect(erl.length).toBeGreaterThan(0);
      expect(python).not.toMatch(/×|MOD_|\?/);
      expect(python).not.toContain("break");
    }
  });

  it("uses while / endwhile for loops", () => {
    const level = levels.find((l) => l.title === "Count to Five");
    if (!level) throw new Error("level missing");
    const { python, erl } = generateCode(level);
    expect(python).toContain("while count <= 5:");
    expect(erl).toContain("endwhile");
  });

  it("uses a Boolean flag for the level 13 Python loop", () => {
    const level = levels.find((l) => l.id === 13);
    if (!level) throw new Error("level missing");
    const { python, erl } = generateCode(level);
    expect(python).toContain("guessed = False\nwhile guessed == False:");
    expect(python).toContain("        guessed = True");
    expect(python).not.toContain("break");
    expect(erl).toContain("until password == correct_password");
  });

  it("uses a sentinel value for level 19", () => {
    const level = levels.find((l) => l.id === 19);
    if (!level) throw new Error("level missing");
    const { python, erl } = generateCode(level);
    expect(python).toContain("number = 1\nwhile number != 0:");
    expect(python.endsWith("print(total)")).toBe(true);
    expect(erl).toContain("endwhile\nprint(total)");
  });

  it("uses a Boolean operator for the level 21 range check", () => {
    const level = levels.find((l) => l.id === 21);
    if (!level) throw new Error("level missing");
    expect(generateCode(level).python).toContain(
      "if number >= 1 and number <= 10:",
    );
  });

  it("uses elif / elseif for nested selection", () => {
    const level = levels.find((l) => l.title === "Grade Boundaries");
    if (!level) throw new Error("level missing");
    const { python, erl } = generateCode(level);
    expect(python).toContain("elif mark >= 50:");
    expect(erl).toContain("elseif mark >= 50 then");
    expect(erl.trim().endsWith("endif")).toBe(true);
  });
});

describe("generateERLURL", () => {
  it("encodes code for the ERL IDE", () => {
    const url = generateERLURL('a = "x"\nprint(a)');
    expect(url).toBe(
      "https://www.examreferencelanguage.co.uk/index.php?code=%5B%7B%22name%22%3A%22code%22%2C%22content%22%3A%22a+%3D+%5C%22x%5C%22%5Cnprint%28a%29%22%7D%5D",
    );
  });
});
