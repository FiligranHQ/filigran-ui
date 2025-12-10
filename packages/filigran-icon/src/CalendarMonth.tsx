import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCalendarMonth = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 20"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="calendar_month_svg__a"
      width={24}
      height={24}
      x={-3}
      y={-2}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3-2h24v24H-3z" />
    </mask>
    <g mask="url(#calendar_month_svg__a)">
      <path
        fill="currentColor"
        d="M2 20q-.824 0-1.412-.587A1.93 1.93 0 0 1 0 18V4q0-.824.588-1.412A1.93 1.93 0 0 1 2 2h1V0h2v2h8V0h2v2h1q.824 0 1.413.587Q18 3.176 18 4v14q0 .824-.587 1.413A1.93 1.93 0 0 1 16 20zm0-2h14V8H2zM2 6h14V4H2zm7 6a.97.97 0 0 1-.713-.287A.97.97 0 0 1 8 11q0-.424.287-.713A.97.97 0 0 1 9 10q.424 0 .713.287.287.288.287.713 0 .424-.287.713A.97.97 0 0 1 9 12m-4 0a.97.97 0 0 1-.713-.287A.97.97 0 0 1 4 11q0-.424.287-.713A.97.97 0 0 1 5 10q.424 0 .713.287Q6 10.576 6 11q0 .424-.287.713A.97.97 0 0 1 5 12m8 0a.97.97 0 0 1-.713-.287A.97.97 0 0 1 12 11q0-.424.287-.713A.97.97 0 0 1 13 10q.424 0 .713.287.287.288.287.713 0 .424-.287.713A.97.97 0 0 1 13 12m-4 4a.97.97 0 0 1-.713-.287A.97.97 0 0 1 8 15q0-.424.287-.713A.97.97 0 0 1 9 14q.424 0 .713.287.287.288.287.713 0 .424-.287.713A.97.97 0 0 1 9 16m-4 0a.97.97 0 0 1-.713-.287A.97.97 0 0 1 4 15q0-.424.287-.713A.97.97 0 0 1 5 14q.424 0 .713.287Q6 14.576 6 15q0 .424-.287.713A.97.97 0 0 1 5 16m8 0a.97.97 0 0 1-.713-.287A.97.97 0 0 1 12 15q0-.424.287-.713A.97.97 0 0 1 13 14q.424 0 .713.287.287.288.287.713 0 .424-.287.713A.97.97 0 0 1 13 16"
      />
    </g>
  </svg>
);
export default SvgCalendarMonth;
