import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgReadMore = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 20 11"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="read_more_svg__a"
      width={24}
      height={25}
      x={-2}
      y={-7}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-2-6.55h24v24H-2z" />
    </mask>
    <g mask="url(#read_more_svg__a)">
      <path
        fill="currentColor"
        d="m5.45 10.9-1.4-1.4 3.025-3.05H0v-2h7.075L4.05 1.4 5.45 0l5.45 5.45zm5.55-.45v-2h9v2zm0-8v-2h9v2zm3 4v-2h6v2z"
      />
    </g>
  </svg>
);
export default SvgReadMore;
