import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgGrade = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 20 19"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="grade_svg__a"
      width={24}
      height={24}
      x={-2}
      y={-2}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-2-2h24v24H-2z" />
    </mask>
    <g mask="url(#grade_svg__a)">
      <path
        fill="currentColor"
        d="m6.85 14.825 3.15-1.9 3.15 1.925-.825-3.6 2.775-2.4-3.65-.325-1.45-3.4L8.55 8.5l-3.65.325 2.775 2.425zM3.825 19l1.625-7.025L0 7.25l7.2-.625L10 0l2.8 6.625 7.2.625-5.45 4.725L16.175 19 10 15.275z"
      />
    </g>
  </svg>
);
export default SvgGrade;
