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
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#attribute_svg__a)">
      <path
        fill="currentColor"
        d="M3.895 9h15.579v2H3.894zm0 4h9.737v2H3.895z"
      />
    </g>
    <defs>
      <clipPath id="attribute_svg__a">
        <path fill="#fff" d="M0 0h23.368v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgAttribute;
