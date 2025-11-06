export type Capability =
  | "text"
  | "tool"
  | "vision"
  | "thinking"
  | "embedding"
  | "cloud";

export interface ModelCapability {
  capabilities: Capability[];
}

export const modelCapabilities = {
  "granite4:1b-h": { capabilities: ["tool", "text"] },
  "granite3.2:2b": { capabilities: ["tool", "text"] },
  "embeddinggemma:300m": { capabilities: ["embedding"] },
  "qwen3-vl:2b": { capabilities: ["vision", "thinking", "text"] },
  "gemma3:1b": { capabilities: ["text"] },
  "llama3.2:3b": { capabilities: ["tool", "text"] },
  "llama3.2:1b": { capabilities: ["tool", "text"] },
  "deepseek-r1:1.5b": { capabilities: ["thinking", "tool", "text"] },
  "phi4-mini:3.8b": { capabilities: ["tool", "text"] },
  "phi3:3.8b": { capabilities: ["text"] },
  "qwen3-coder:480b-cloud": { capabilities: ["cloud", "tool"] },
  "glm-4.6:cloud": { capabilities: ["cloud", "tool"] },
} as const satisfies Record<string, ModelCapability>;

export type ModelName = keyof typeof modelCapabilities;

export const modelNames = Object.keys(modelCapabilities) as ModelName[];

export function getCapabilities(model: string): readonly Capability[] {
  const entry = (
    Object.entries(modelCapabilities) as [ModelName, ModelCapability][]
  ).find(([key]) => model.startsWith(key));
  return entry ? entry[1].capabilities : [];
}

export function hasCapability(model: string, capability: Capability): boolean {
  return getCapabilities(model).includes(capability);
}

export function listModelsWith(capability: Capability): ModelName[] {
  return (Object.entries(modelCapabilities) as [ModelName, ModelCapability][])
    .filter(([, { capabilities }]) => capabilities.includes(capability))
    .map(([name]) => name);
}
