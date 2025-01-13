import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLink = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 20 10"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="link_svg__a"
      width={24}
      height={24}
      x={-2}
      y={-7}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-2-7h24v24H-2z" />
    </mask>
    <g mask="url(#link_svg__a)">
      <path
        fill="currentColor"
        d="M9 10H5q-2.075 0-3.537-1.463Q0 7.076 0 5t1.463-3.537T5 0h4v2H5q-1.25 0-2.125.875A2.9 2.9 0 0 0 2 5q0 1.25.875 2.125A2.9 2.9 0 0 0 5 8h4zM6 6V4h8v2zm5 4V8h4q1.25 0 2.125-.875A2.9 2.9 0 0 0 18 5q0-1.25-.875-2.125A2.9 2.9 0 0 0 15 2h-4V0h4q2.075 0 3.538 1.463Q20 2.925 20 5t-1.462 3.537Q17.074 10 15 10z"
      />
    </g>
  </svg>
);
export default SvgLink;
