import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgUnknown = ({
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
    <g clipPath="url(#unknown_svg__a)">
      <path
        fill="currentColor"
        d="M16.958 27.75h3.084v-3.083h-3.084zM18.5 3.083C9.99 3.083 3.083 9.99 3.083 18.5S9.99 33.917 18.5 33.917 33.917 27.01 33.917 18.5 27.01 3.083 18.5 3.083m0 27.75c-6.799 0-12.333-5.534-12.333-12.333S11.7 6.167 18.5 6.167 30.833 11.7 30.833 18.5 25.3 30.833 18.5 30.833m0-21.583a6.165 6.165 0 0 0-6.167 6.167h3.084a3.09 3.09 0 0 1 3.083-3.084 3.09 3.09 0 0 1 3.083 3.084c0 3.083-4.625 2.698-4.625 7.708h3.084c0-3.469 4.625-3.854 4.625-7.708A6.165 6.165 0 0 0 18.5 9.25"
      />
    </g>
    <defs>
      <clipPath id="unknown_svg__a">
        <path fill="#fff" d="M0 0h37v37H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgUnknown;
