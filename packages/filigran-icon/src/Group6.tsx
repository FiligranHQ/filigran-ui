import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgGroup6 = ({
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
    <circle
      cx={11.539}
      cy={11.538}
      r={5.923}
      stroke="currentColor"
      strokeWidth={2}
    />
    <path
      stroke="currentColor"
      strokeWidth={3}
      d="M0 21.577h8.308M1.5 14.769v8.308M24 1.5h-8.308M22.5 8.308V0M1.5 0v8.308M8.308 1.5H0M22.5 23.077v-8.308M15.692 21.577H24"
    />
  </svg>
);
export default SvgGroup6;
