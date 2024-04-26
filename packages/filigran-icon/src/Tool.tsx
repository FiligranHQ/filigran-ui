import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgTool = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 38 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M30.083 6.167c1.758 0 3.167 1.387 3.167 3.083v18.5c0 .818-.334 1.602-.928 2.18a3.2 3.2 0 0 1-2.239.903H7.917c-1.758 0-3.167-1.387-3.167-3.083V9.25c0-.818.334-1.602.928-2.18a3.2 3.2 0 0 1 2.239-.903zm0 21.583V12.333H7.917V27.75z"
    />
  </svg>
);
export default SvgTool;
