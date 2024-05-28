import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgObservedData = ({
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
    <g clipPath="url(#observed-data_svg__a)">
      <path
        fill="currentColor"
        d="M11.684 11c-1.07 0-1.947.9-1.947 2s.876 2 1.947 2 1.948-.9 1.948-2-.877-2-1.948-2m5.842 2c0-3.31-2.619-6-5.842-6s-5.842 2.69-5.842 6c0 2.22 1.178 4.15 2.921 5.19l.974-1.74A4.02 4.02 0 0 1 7.789 13c0-2.21 1.743-4 3.895-4s3.895 1.79 3.895 4c0 1.48-.789 2.75-1.947 3.45l.973 1.74A6.03 6.03 0 0 0 17.526 13M11.684 3C6.31 3 1.947 7.48 1.947 13c0 3.7 1.957 6.92 4.86 8.65l.973-1.73A8.05 8.05 0 0 1 3.895 13c0-4.42 3.486-8 7.79-8 4.303 0 7.789 3.58 7.789 8 0 2.96-1.568 5.53-3.895 6.92l.974 1.73c2.911-1.73 4.868-4.95 4.868-8.65 0-5.52-4.362-10-9.737-10"
      />
    </g>
    <defs>
      <clipPath id="observed-data_svg__a">
        <path fill="#fff" d="M0 0h23.368v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgObservedData;
