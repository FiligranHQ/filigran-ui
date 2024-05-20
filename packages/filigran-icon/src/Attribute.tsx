import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgAttribute = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#attribute_svg__a)">
      <path
        fill="currentColor"
        d="M6.167 14.25h24.666v3.167H6.167zm0 6.333h15.416v3.167H6.167z"
      />
    </g>
    <defs>
      <clipPath id="attribute_svg__a">
        <path fill="#fff" d="M0 0h37v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgAttribute;
