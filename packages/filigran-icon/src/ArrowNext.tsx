import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowNext = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 11 14"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="arrow_next_svg__a"
      width={24}
      height={25}
      x={-8}
      y={-5}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-8-5h24v24H-8z" />
    </mask>
    <g mask="url(#arrow_next_svg__a)">
      <path fill="currentColor" d="M0 14V0l11 7z" />
    </g>
  </svg>
);
export default SvgArrowNext;
