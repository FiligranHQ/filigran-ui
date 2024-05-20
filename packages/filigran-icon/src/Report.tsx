import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgReport = ({
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
    <g clipPath="url(#report_svg__a)">
      <path
        fill="currentColor"
        d="M12.667 24.667h12.666v3.083H12.667zm0-6.167h12.666v3.083H12.667zm9.5-15.417H9.5c-1.742 0-3.167 1.388-3.167 3.084v24.666c0 1.696 1.41 3.084 3.151 3.084H28.5c1.742 0 3.167-1.388 3.167-3.084v-18.5zm6.333 27.75h-19V6.167h11.083v7.708H28.5z"
      />
    </g>
    <defs>
      <clipPath id="report_svg__a">
        <path fill="#fff" d="M0 0h38v37H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgReport;
