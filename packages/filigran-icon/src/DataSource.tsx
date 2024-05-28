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
    viewBox="0 0 25 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#data-source_svg__a)">
      <path
        fill="currentColor"
        d="M20.54 6h-8.216L10.27 4H4.108c-1.13 0-2.044.9-2.044 2l-.01 12c0 1.1.924 2 2.054 2h16.433c1.13 0 2.054-.9 2.054-2V8c0-1.1-.925-2-2.054-2m0 12H4.109V6h5.31l2.054 2h9.069zm-2.053-6H6.162v-2h12.325zm-4.109 4H6.162v-2h8.216z"
      />
    </g>
    <defs>
      <clipPath id="data-source_svg__a">
        <path fill="#fff" d="M0 0h24.649v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgDataSource;
