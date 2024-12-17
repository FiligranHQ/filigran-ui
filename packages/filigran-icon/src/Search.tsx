import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgSearch = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="search_svg__a"
      width={24}
      height={24}
      x={-3}
      y={-3}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3-3h24v24H-3z" />
    </mask>
    <g mask="url(#search_svg__a)">
      <path
        fill="currentColor"
        d="m16.6 18-6.3-6.3q-.75.6-1.725.95T6.5 13q-2.725 0-4.612-1.887T0 6.5t1.888-4.612T6.5 0t4.613 1.888T13 6.5a6.1 6.1 0 0 1-1.3 3.8l6.3 6.3zM6.5 11q1.875 0 3.188-1.312Q11 8.375 11 6.5T9.688 3.313 6.5 2 3.313 3.313 2 6.5t1.313 3.188T6.5 11"
      />
    </g>
  </svg>
);
export default SvgSearch;
