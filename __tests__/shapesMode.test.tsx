import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LevelPlayer } from "../app/components/LevelPlayer";
import { getLevel } from "../app/lib/levels";
import type { Level } from "../app/lib/types";

jest.mock("react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const level = getLevel(11) as Level;

beforeEach(() => localStorage.clear());

it("shows each slot's text before a shape is placed and provides one tool per shape", () => {
  render(<LevelPlayer level={level} mode="shapes" />);

  expect(screen.getByText(level.instructions)).toBeInTheDocument();
  expect(screen.getByTestId("slot-start")).toHaveTextContent("Start");
  expect(screen.getByTestId("slot-end")).toHaveTextContent("End");
  for (const shape of ["terminator", "io", "process", "decision"]) {
    expect(screen.getByTestId(`shape-${shape}`)).toBeInTheDocument();
    expect(screen.getByTestId(`shape-${shape}`)).toHaveTextContent(/^$/);
  }
  expect(screen.getByTestId("label-drop-d1->o1")).toHaveTextContent(
    "Drop Yes/No",
  );
  expect(screen.getByTestId("label-tool-Yes")).toBeInTheDocument();
  expect(screen.getByTestId("label-tool-No")).toBeInTheDocument();
});

it("keeps toolbox shapes reusable and requires decision labels", async () => {
  const user = userEvent.setup();
  render(<LevelPlayer level={level} mode="shapes" nextId={12} />);

  for (const node of level.nodes) {
    const shape = level.items.find((item) => item.id === node.answer)?.shape;
    if (!shape) throw new Error(`Missing answer for ${node.id}`);
    await user.click(screen.getByTestId(`shape-${shape}`));
    await user.click(screen.getByTestId(`slot-${node.id}`));
  }
  await user.click(screen.getByRole("button", { name: "Check Answer" }));

  expect(screen.getByRole("status")).toHaveTextContent("4 still to place");
  expect(screen.getByRole("status")).not.toHaveTextContent("Correct");
  expect(screen.getByTestId("shape-terminator")).toBeInTheDocument();
});

it("lets touch users drag a shape from the toolbox onto a slot", () => {
  render(<LevelPlayer level={level} mode="shapes" />);
  const tool = screen.getByTestId("shape-process");
  const node = level.nodes[1];
  if (!node) throw new Error("Missing test slot");
  const answer = level.items.find((item) => item.id === node.answer);
  if (!answer) throw new Error(`Missing answer for ${node.id}`);
  const slot = screen.getByTestId(`slot-${node.id}`);
  const elementFromPoint = jest.fn(() => slot);
  const originalElementFromPoint = Object.getOwnPropertyDescriptor(
    document,
    "elementFromPoint",
  );
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: elementFromPoint,
  });

  try {
    fireEvent.pointerDown(tool, { pointerId: 7, pointerType: "touch" });
    fireEvent.pointerUp(window, { pointerId: 7, pointerType: "touch" });
  } finally {
    if (originalElementFromPoint) {
      Object.defineProperty(
        document,
        "elementFromPoint",
        originalElementFromPoint,
      );
    } else {
      Reflect.deleteProperty(document, "elementFromPoint");
    }
  }

  expect(slot).toHaveTextContent(answer.text);
  expect(slot).toHaveAttribute("aria-label", `Slot 2: ${answer.text}, process`);
  expect(elementFromPoint).toHaveBeenCalled();
});

it("shows label drop targets on the decision lines", async () => {
  const user = userEvent.setup();
  render(<LevelPlayer level={level} mode="shapes" />);

  for (const node of level.nodes) {
    const shape = level.items.find((item) => item.id === node.answer)?.shape;
    if (!shape) throw new Error(`Missing answer for ${node.id}`);
    await user.click(screen.getByTestId(`shape-${shape}`));
    await user.click(screen.getByTestId(`slot-${node.id}`));
  }
  await user.click(screen.getByRole("button", { name: "Check Answer" }));
  expect(screen.getByRole("status")).toHaveTextContent("Yes/No labels correct");
  expect(screen.getByTestId("label-drop-d1->o1")).toHaveTextContent(
    "Drop Yes/No",
  );
});

it("does not offer Yes/No labels when the chart has no decisions", () => {
  render(<LevelPlayer level={getLevel(1) as Level} mode="shapes" />);

  expect(screen.queryByTestId("label-tool-Yes")).toBeNull();
  expect(screen.queryByTestId("label-tool-No")).toBeNull();
});

it("counts the fixed Start shape as already placed on level 30", async () => {
  const user = userEvent.setup();
  render(<LevelPlayer level={getLevel(30) as Level} mode="shapes" />);

  expect(screen.getByText(/1\/10 shapes placed/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Check Answer" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "1 of 10 shapes correct, 9 slots still empty.",
  );
  expect(screen.getByTestId("slot-start")).toHaveAttribute(
    "aria-label",
    "Slot 1: Start, terminator",
  );
});

it("rejects a wrong shape even when the box text is visible", async () => {
  const user = userEvent.setup();
  render(<LevelPlayer level={level} mode="shapes" />);

  await user.click(screen.getByTestId("shape-io"));
  await user.click(screen.getByTestId("slot-start"));
  await user.click(screen.getByRole("button", { name: "Check Answer" }));

  expect(screen.getByRole("status")).not.toHaveTextContent("Correct");
  expect(screen.getByTestId("slot-start")).toHaveTextContent("Start");
});
