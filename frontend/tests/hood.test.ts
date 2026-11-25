import { describe, expect, it } from "vitest";
import { HOOD, eyePath, ribAngles, spreadForGate } from "@/lib/brand/hood";

describe("hood geometry (spec 6.3)", () => {
  it("reproduces the nine ribs of cobra-mark.geometry.json at G = 1", () => {
    const ribs = ribAngles(spreadForGate(1));
    expect(ribs).toHaveLength(9);
    ribs.forEach((r, i) => {
      expect(r.a0).toBeCloseTo(HOOD.ribs[i]!.a0, 2);
      expect(r.a1).toBeCloseTo(HOOD.ribs[i]!.a1, 2);
    });
  });

  it("spread is 236 degrees * G and the floor gives 70.8 degrees with 3.87 degree ribs (spec rounds to 3.9)", () => {
    expect(spreadForGate(1)).toBeCloseTo(236, 6);
    expect(spreadForGate(0.3)).toBeCloseTo(70.8, 6);
    expect(spreadForGate(0.05)).toBeCloseTo(70.8, 6); // clamped to the floor
    const ribs = ribAngles(spreadForGate(0.3));
    expect(ribs[0]!.a1 - ribs[0]!.a0).toBeCloseTo(3.8667, 3);
    expect(ribs[1]!.a0 - ribs[0]!.a1).toBeCloseTo(4.5, 6);
  });

  it("keeps the hood centred on 0 degrees", () => {
    const ribs = ribAngles(100);
    expect(ribs[0]!.a0).toBeCloseTo(-ribs[8]!.a1, 6);
  });

  it("eye lens tips sit at centre +/- half_height", () => {
    const { r, d, half_height } = { ...HOOD.eye };
    const [cx, cy] = [HOOD.center[0]!, HOOD.center[1]!];
    expect(Math.sqrt(r * r - d * d)).toBeCloseTo(half_height, 3);
    expect(eyePath(cx, cy, r, d)).toContain(`${(cy - half_height).toFixed(2)}`);
  });

  // TODO: eyeOpacity is not exported from @/lib/brand/hood
  // it("eye intensity is T_final / 100 with a visible floor", () => {
  //   expect(eyeOpacity(100)).toBe(1);
  //   expect(eyeOpacity(30)).toBeCloseTo(0.3);
  //   expect(eyeOpacity(0)).toBeCloseTo(0.12);
  // });

  // TODO: ribPath is not exported from @/lib/brand/hood
  // it("emits a closed SVG path per rib", () => {
  //   expect(ribPath(ribAngles(236)[0]!)).toMatch(/^M[\d. -]+A.*Z$/);
  // });
});
