import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgDelete = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 18"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="delete_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-3}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-3h24v24H-4z" />
    </mask>
    <g mask="url(#delete_svg__a)">
      <path
        fill="currentColor"
        d="M3 18q-.824 0-1.412-.587A1.93 1.93 0 0 1 1 16V3H0V1h5V0h6v1h5v2h-1v13q0 .824-.588 1.413A1.93 1.93 0 0 1 13 18zM13 3H3v13h10zM5 14h2V5H5zm4 0h2V5H9z"
      />
    </g>
  </svg>
);
export default SvgDelete;
