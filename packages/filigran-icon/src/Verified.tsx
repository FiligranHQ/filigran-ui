import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgVerified = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 22 21"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="verified_svg__a"
      width={24}
      height={25}
      x={-1}
      y={-2}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-1-1.5h24v24H-1z" />
    </mask>
    <g mask="url(#verified_svg__a)">
      <path
        fill="currentColor"
        d="m7.6 21-1.9-3.2-3.6-.8.35-3.7L0 10.5l2.45-2.8L2.1 4l3.6-.8L7.6 0 11 1.45 14.4 0l1.9 3.2 3.6.8-.35 3.7L22 10.5l-2.45 2.8.35 3.7-3.6.8-1.9 3.2-3.4-1.45zm.85-2.55 2.55-1.1 2.6 1.1 1.4-2.4 2.75-.65-.25-2.8 1.85-2.1-1.85-2.15.25-2.8-2.75-.6-1.45-2.4L11 3.65l-2.6-1.1L7 4.95l-2.75.6.25 2.8-1.85 2.15 1.85 2.1-.25 2.85 2.75.6zm1.5-4.4L15.6 8.4l-1.4-1.45-4.25 4.25L7.8 9.1l-1.4 1.4z"
      />
    </g>
  </svg>
);
export default SvgVerified;
