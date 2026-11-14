import { Rpc } from "@opencode/plugin/rpc";

const definition = {
  id: "squad",
  events: {},
  methods: {
    state: {
      input: {
        type: "object",
        properties: { mission_id: { type: "string" } },
        additionalProperties: false,
      },
      output: { type: "object", additionalProperties: true },
    },
    plan: {
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
          action: { type: "string", enum: ["approve", "reject"] },
          note: { type: "string" },
        },
        required: ["mission_id", "action"],
        additionalProperties: false,
      },
      output: { type: "object", additionalProperties: true },
    },
  },
} as const;

export const SquadRpc: Rpc.PortableDefinition = Rpc.define(definition);
