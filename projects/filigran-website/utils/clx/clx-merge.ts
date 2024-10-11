import { twMerge } from "tailwind-merge";
import { createClassed } from "./classed";

const { classed } = createClassed({ merger: twMerge });

export { classed as clx };
