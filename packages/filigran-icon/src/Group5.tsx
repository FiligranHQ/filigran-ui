import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgGroup5 = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 26 25"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <circle cx={12.5} cy={12.5} r={6.5} stroke="currentColor" strokeWidth={2} />
    <path
      stroke="currentColor"
      strokeWidth={3}
      d="M0 23.5h9M1.5 16v9M26 1.5h-9M24.5 9V0M1.5 0v9M9 1.5H0M24.5 25v-9M17 23.5h9"
    />
  </svg>
);
export default SvgGroup5;
