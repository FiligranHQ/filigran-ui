import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgChecklistRtl = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 20 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="checklist_rtl_svg__a"
      width={24}
      height={25}
      x={-2}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-2-3.925h24v24H-2z" />
    </mask>
    <g mask="url(#checklist_rtl_svg__a)">
      <path
        fill="currentColor"
        d="m14.375 15.075-3.55-3.55 1.4-1.4 2.125 2.125L18.6 8 20 9.425zm0-8-3.55-3.55 1.4-1.4L14.35 4.25 18.6 0 20 1.425zM0 13.075v-2h9v2zm0-8v-2h9v2z"
      />
    </g>
  </svg>
);
export default SvgChecklistRtl;
