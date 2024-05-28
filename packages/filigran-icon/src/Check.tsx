import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCheck = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 17 13"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="check_svg__a"
      width={27}
      height={26}
      x={-5}
      y={-7}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4.015-6.232h25.031v25.031H-4.015z" />
    </mask>
    <g mask="url(#check_svg__a)">
      <path
        fill="currentColor"
        d="M5.945 12.541 0 6.597 1.486 5.11 5.945 9.57 15.514 0 17 1.486z"
      />
    </g>
  </svg>
);
export default SvgCheck;
