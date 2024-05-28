import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgExternalReference = ({
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
    <g fill="currentColor" clipPath="url(#external-reference_svg__a)">
      <path d="m20.847 11.58-8.764-9A1.9 1.9 0 0 0 10.71 2H3.895c-1.071 0-1.948.9-1.948 2v7c0 .55.215 1.05.575 1.42l8.763 9c.35.36.837.58 1.373.58a1.88 1.88 0 0 0 1.373-.59l6.816-7c.36-.36.574-.86.574-1.41s-.224-1.06-.574-1.42m-8.19 8.43L3.896 11V4h6.816v-.01l8.763 9z" />
      <path d="M6.329 8c.807 0 1.46-.672 1.46-1.5S7.136 5 6.33 5s-1.46.672-1.46 1.5S5.521 8 6.328 8" />
    </g>
    <defs>
      <clipPath id="external-reference_svg__a">
        <path fill="#fff" d="M0 0h23.368v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgExternalReference;
