
import { z } from 'z';

export const MindMapNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    icon: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.string().optional(),
    owner: z.string().optional(),
    milestone: z.string().optional(),
    url: z.string().url().optional(),
    style: z.object({
      accent: z.string().optional(),
      bg: z.string().optional(),
      text: z.string().optional(),
    }).optional(),
    children: z.array(MindMapNodeSchema).optional().default([]),
  })
);

export const MindMapDslSchema = z.object({
  // Fix: Provided full default object to .default() to satisfy Zod type inference requirements for nested objects with defaults.
  meta: z.object({
    title: z.string().optional(),
    layout: z.enum(['RADIAL', 'TREE']).default('RADIAL'),
    theme: z.string().default('NEXUS'),
    nodeWidth: z.number().default(240),
    nodeHeight: z.number().default(80),
    radiusStep: z.number().default(200),
  }).default({
    layout: 'RADIAL',
    theme: 'NEXUS',
    nodeWidth: 240,
    nodeHeight: 80,
    radiusStep: 200
  }),
  root: MindMapNodeSchema,
});

export type MindMapDsl = z.infer<typeof MindMapDslSchema>;
export type MindMapNodeData = z.infer<typeof MindMapNodeSchema>;

export const DEFAULT_MINDMAP_JSON = JSON.stringify({
  meta: {
    title: "Nexus Portfolio Blueprint",
    layout: "RADIAL",
    nodeWidth: 260,
    nodeHeight: 84,
    radiusStep: 220
  },
  root: {
    id: "root",
    label: "Nexus Delivery Hub",
    icon: "🚀",
    style: { accent: "#0f172a", bg: "#0f172a", text: "#ffffff" },
    children: [
      {
        id: "portfolio",
        label: "Strategic Portfolio",
        icon: "💼",
        status: "ACTIVE",
        style: { accent: "#2563eb" },
        tags: ["Governance", "Investment"],
        children: [
          { id: "p1", label: "Core Banking Modernization", status: "ON_TRACK", tags: ["Cloud"], children: [] },
          { id: "p2", label: "Digital Channels", status: "AT_RISK", tags: ["Mobile"], children: [] }
        ]
      },
      {
        id: "architecture",
        label: "Enterprise Architecture",
        icon: "🏛️",
        style: { accent: "#7c3aed" },
        tags: ["Standards", "Blueprints"],
        children: [
          { id: "a1", label: "Microservices Framework", children: [] },
          { id: "a2", label: "Event-Driven Backbone", children: [] }
        ]
      },
      {
        id: "security",
        label: "Security & Compliance",
        icon: "🛡️",
        style: { accent: "#dc2626" },
        children: [
          { id: "s1", label: "Zero-Trust Protocol", children: [] },
          { id: "s2", label: "IAM Convergence", children: [] }
        ]
      }
    ]
  }
}, null, 2);

export function safeMindMapParse(content: string): { data: MindMapDsl | null; error: string | null } {
  if (!content || content.trim() === "" || content === "undefined") {
    return { data: JSON.parse(DEFAULT_MINDMAP_JSON), error: null };
  }
  try {
    const raw = JSON.parse(content);
    const parsed = MindMapDslSchema.safeParse(raw);
    if (!parsed.success) {
      // Fix: Used .issues instead of .errors to correctly access the ZodError details.
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { data: parsed.data, error: null };
  } catch (e) {
    return { data: null, error: "Invalid JSON format" };
  }
}
