import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgCalendarViewMonth = ({
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
    <g clipPath="url(#calendar-view-month_svg__a)">
      <path
        fill="currentColor"
        d="M29.167 5.833H5.833A2.925 2.925 0 0 0 2.917 8.75v17.5a2.925 2.925 0 0 0 2.916 2.917h23.334a2.925 2.925 0 0 0 2.916-2.917V8.75a2.925 2.925 0 0 0-2.916-2.917m-17.5 10.209H5.833V8.75h5.834zm8.75 0h-5.834V8.75h5.834zm8.75 0h-5.834V8.75h5.834zm-17.5 10.208H5.833v-7.292h5.834zm8.75 0h-5.834v-7.292h5.834zm8.75 0h-5.834v-7.292h5.834z"
      />
    </g>
    <defs>
      <clipPath id="calendar-view-month_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgCalendarViewMonth;
