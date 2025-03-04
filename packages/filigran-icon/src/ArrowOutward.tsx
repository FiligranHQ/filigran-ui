import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowOutward = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 13 13"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="arrow_outward_svg__a"
      width={24}
      height={24}
      x={-5}
      y={-5}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-5-5h24v24H-5z" />
    </mask>
    <g mask="url(#arrow_outward_svg__a)">
      <path fill="currentColor" d="M1.4 13 0 11.6 9.6 2H1V0h12v12h-2V3.4z" />
    </g>
  </svg>
);
export default SvgArrowOutward;
