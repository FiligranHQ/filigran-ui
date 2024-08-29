import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgThreatActorIndividual = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M30.833 6.167a3.08 3.08 0 0 1 3.084 3.083v15.417a3.073 3.073 0 0 1-3.084 3.083H37v3.083H0V27.75h6.167a3.083 3.083 0 0 1-3.084-3.083V9.25a3.073 3.073 0 0 1 3.084-3.083zm0 3.083H6.167v15.417h24.666zM18.5 18.5c3.407 0 6.167 1.387 6.167 3.083v1.542H12.333v-1.542c0-1.695 2.76-3.083 6.167-3.083m0-7.708a3.08 3.08 0 0 1 3.083 3.083 3.08 3.08 0 0 1-3.083 3.083 3.073 3.073 0 0 1-3.083-3.083 3.08 3.08 0 0 1 3.083-3.083"
    />
  </svg>
);
export default SvgThreatActorIndividual;
