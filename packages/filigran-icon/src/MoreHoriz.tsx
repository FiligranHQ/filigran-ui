import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgMoreHoriz = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 4"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="more_horiz_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-10}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-10h24v24H-4z" />
    </mask>
    <g mask="url(#more_horiz_svg__a)">
      <path
        fill="currentColor"
        d="M2 4q-.824 0-1.412-.587A1.93 1.93 0 0 1 0 2Q0 1.176.588.588A1.93 1.93 0 0 1 2 0q.824 0 1.413.588Q4 1.175 4 2q0 .824-.587 1.413A1.93 1.93 0 0 1 2 4m6 0q-.824 0-1.412-.587A1.93 1.93 0 0 1 6 2q0-.824.588-1.412A1.93 1.93 0 0 1 8 0q.825 0 1.412.588Q10 1.175 10 2q0 .824-.588 1.413A1.93 1.93 0 0 1 8 4m6 0q-.825 0-1.412-.587A1.93 1.93 0 0 1 12 2q0-.824.588-1.412A1.93 1.93 0 0 1 14 0q.825 0 1.412.588Q16 1.175 16 2q0 .824-.588 1.413A1.93 1.93 0 0 1 14 4"
      />
    </g>
  </svg>
);
export default SvgMoreHoriz;
