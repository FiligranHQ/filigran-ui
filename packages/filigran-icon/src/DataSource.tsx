import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgDataSource = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 38 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#data-source_svg__a)">
      <path
        fill="currentColor"
        d="M31.667 9.25H19l-3.167-3.083h-9.5c-1.741 0-3.15 1.387-3.15 3.083l-.016 18.5c0 1.696 1.425 3.083 3.166 3.083h25.334c1.741 0 3.166-1.387 3.166-3.083V12.333c0-1.696-1.425-3.083-3.166-3.083m0 18.5H6.333V9.25h8.186l3.167 3.083h13.98zM28.5 18.5h-19v-3.083h19zm-6.333 6.167H9.5v-3.084h12.667z"
      />
    </g>
    <defs>
      <clipPath id="data-source_svg__a">
        <path fill="#fff" d="M0 0h38v37H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgDataSource;
