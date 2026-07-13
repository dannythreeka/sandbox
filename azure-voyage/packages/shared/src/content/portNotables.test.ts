import { describe, expect, it } from "vitest";
import { PORT_NOTABLE_ARCHETYPES, PORT_NOTABLE_TEMPLATES, portNotableTemplateForPort } from "./portNotables";
import { PORTS } from "./ports";

describe("port notable content", () => {
  it("has exactly one notable per current port", () => {
    expect(PORT_NOTABLE_TEMPLATES).toHaveLength(PORTS.length);
    const templatePortIds = new Set(PORT_NOTABLE_TEMPLATES.map((t) => t.portId));
    for (const port of PORTS) {
      expect(templatePortIds.has(port.id), `${port.id} has no notable`).toBe(true);
    }
  });

  it("has unique names and valid archetypes", () => {
    expect(new Set(PORT_NOTABLE_TEMPLATES.map((t) => t.name)).size).toBe(PORT_NOTABLE_TEMPLATES.length);
    for (const t of PORT_NOTABLE_TEMPLATES) {
      expect(PORT_NOTABLE_ARCHETYPES).toContain(t.archetype);
    }
  });

  it("portNotableTemplateForPort returns the matching template and throws for unknown ports", () => {
    const home = portNotableTemplateForPort("port.amber_gulf.aurelia");
    expect(home.name).toBe("馬瑟斯・凡登霍夫");
    expect(() => portNotableTemplateForPort("port.nowhere.fake")).toThrow();
  });
});
