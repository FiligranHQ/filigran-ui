import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgDragHandle = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 6"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="drag_handle_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-9}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-9h24v24H-4z" />
    </mask>
    <g mask="url(#drag_handle_svg__a)">
      <path fill="currentColor" d="M0 6V4h16v2zm0-4V0h16v2z" />
    </g>
  </svg>
);
export default SvgDragHandle;
