import type { ComponentType } from "react";
import InterArrivalSampler from "./inter-arrival-sampler";

export const TOOL_COMPONENTS: Record<string, ComponentType<unknown>> = {
  "inter-arrival-sampler": InterArrivalSampler,
};
