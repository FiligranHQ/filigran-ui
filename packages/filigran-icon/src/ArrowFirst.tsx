import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowFirst = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 12 14"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="arrow_first_svg__a"
      width={24}
      height={25}
      x={-6}
      y={-6}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M18 19H-6V-5h24z" />
    </mask>
    <g fill="currentColor" mask="url(#arrow_first_svg__a)">
      <path d="M11.5 0v14L.5 7z" />
      <path d="M0 0h2v14H0z" />
    </g>
  </svg>
);
export default SvgArrowFirst;
