import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowUpward = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="arrow_upward_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-4h24v24H-4z" />
    </mask>
    <g mask="url(#arrow_upward_svg__a)">
      <path
        fill="currentColor"
        d="M7 16V3.825l-5.6 5.6L0 8l8-8 8 8-1.4 1.425-5.6-5.6V16z"
      />
    </g>
  </svg>
);
export default SvgArrowUpward;
