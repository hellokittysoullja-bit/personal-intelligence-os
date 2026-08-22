import { describe, expect, it } from "vitest";
import { ConservativePolicyEngine } from "./policy";

const policy = new ConservativePolicyEngine();

describe("ConservativePolicyEngine", () => {
  it("permits only L0/L1 baseline actions automatically", () => {
    expect(policy.decide({ toolName: "read", actionKind: "read_text", channel: "local", riskLevel: "L0" }))
      .toMatchObject({ decision: "auto" });
    expect(policy.decide({ toolName: "write", actionKind: "create_file", channel: "local", riskLevel: "L1" }))
      .toMatchObject({ decision: "auto" });
  });

  it("denies L2 until the project installs an explicit policy", () => {
    expect(policy.decide({ toolName: "install", actionKind: "install_dependency", channel: "local", riskLevel: "L2" }))
      .toMatchObject({ decision: "deny" });
  });

  it("requires approval for external L3/L4 actions and rejects inconsistent local channel", () => {
    expect(policy.decide({ toolName: "browser", actionKind: "submit_form", channel: "browser", riskLevel: "L3" }))
      .toMatchObject({ decision: "require_approval" });
    expect(policy.decide({ toolName: "api", actionKind: "transfer", channel: "external_api", riskLevel: "L4" }))
      .toMatchObject({ decision: "require_approval" });
    expect(policy.decide({ toolName: "local", actionKind: "external_write", channel: "local", riskLevel: "L3" }))
      .toMatchObject({ decision: "deny" });
  });
});
