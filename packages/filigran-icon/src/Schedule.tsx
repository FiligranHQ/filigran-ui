import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgSchedule = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 35 35"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g fill="currentColor" clipPath="url(#schedule_svg__a)">
      <path d="M17.485 2.917C9.435 2.917 2.917 9.45 2.917 17.5s6.518 14.583 14.568 14.583c8.065 0 14.598-6.533 14.598-14.583S25.55 2.917 17.485 2.917m.015 26.25c-6.446 0-11.667-5.221-11.667-11.667S11.054 5.833 17.5 5.833 29.167 11.054 29.167 17.5 23.946 29.167 17.5 29.167" />
      <path d="M18.23 10.208h-2.188v8.75l7.656 4.594 1.094-1.794-6.563-3.893z" />
    </g>
    <defs>
      <clipPath id="schedule_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgSchedule;
