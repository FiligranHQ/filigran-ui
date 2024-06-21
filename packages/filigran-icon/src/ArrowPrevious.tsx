import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowPrevious = ({
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
      id="arrow_previous_svg__a"
      width={24}
      height={25}
      x={-5}
      y={-5}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M19 19H-5V-5h24z" />
    </mask>
    <g mask="url(#arrow_previous_svg__a)">
      <path fill="currentColor" d="M11 0v14L0 7z" />
    </g>
  </svg>
);
export default SvgArrowPrevious;
