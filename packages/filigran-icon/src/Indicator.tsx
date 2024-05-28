import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgIndicator = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M11.684 9c.775 0 1.518.316 2.066.879s.855 1.325.855 2.121-.308 1.559-.855 2.121a2.88 2.88 0 0 1-2.066.879 2.88 2.88 0 0 1-2.065-.879A3.04 3.04 0 0 1 8.763 12c0-.796.308-1.559.856-2.121A2.88 2.88 0 0 1 11.684 9m5.706 10.31c-1.587 1.91-3.486 3.14-5.706 3.69-2.492-.61-4.576-2.07-6.25-4.37C3.757 16.34 2.92 13.8 2.92 11V5l8.763-4 8.763 4v6c0 2.39-.623 4.61-1.87 6.67l-2.833-2.91a5.16 5.16 0 0 0 .809-2.76 5.07 5.07 0 0 0-1.426-3.536A4.8 4.8 0 0 0 11.684 7c-1.291 0-2.53.527-3.442 1.464A5.07 5.07 0 0 0 6.816 12a5.07 5.07 0 0 0 1.426 3.536A4.8 4.8 0 0 0 11.684 17c.974 0 1.918-.31 2.688-.83z"
    />
  </svg>
);
export default SvgIndicator;
