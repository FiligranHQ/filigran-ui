import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgGrouping = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#grouping_svg__a)">
      <path
        fill="currentColor"
        d="M5.842 15c1.071 0 1.947.9 1.947 2s-.876 2-1.947 2c-1.07 0-1.947-.9-1.947-2s.876-2 1.947-2m0-2c-2.142 0-3.895 1.8-3.895 4s1.753 4 3.895 4 3.895-1.8 3.895-4-1.753-4-3.895-4m5.842-8c1.071 0 1.948.9 1.948 2s-.877 2-1.948 2-1.947-.9-1.947-2 .876-2 1.947-2m0-2C9.542 3 7.79 4.8 7.79 7s1.753 4 3.895 4 3.895-1.8 3.895-4-1.753-4-3.895-4m5.842 12c1.071 0 1.948.9 1.948 2s-.877 2-1.948 2-1.947-.9-1.947-2 .876-2 1.947-2m0-2c-2.142 0-3.894 1.8-3.894 4s1.752 4 3.894 4 3.895-1.8 3.895-4-1.753-4-3.895-4"
      />
    </g>
    <defs>
      <clipPath id="grouping_svg__a">
        <path fill="#fff" d="M0 0h23.368v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgGrouping;
