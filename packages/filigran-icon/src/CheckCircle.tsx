import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCheckCircle = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="m7.067 11.067 4.7-4.7-.934-.934L7.067 9.2l-1.9-1.9-.934.933zm.933 3.6a6.5 6.5 0 0 1-2.6-.525 6.7 6.7 0 0 1-2.117-1.425A6.7 6.7 0 0 1 1.858 10.6 6.5 6.5 0 0 1 1.333 8q0-1.383.525-2.6a6.7 6.7 0 0 1 1.425-2.117q.9-.9 2.117-1.425A6.5 6.5 0 0 1 8 1.333q1.383 0 2.6.525t2.117 1.425T14.142 5.4t.525 2.6-.525 2.6a6.7 6.7 0 0 1-1.425 2.117q-.9.9-2.117 1.425a6.5 6.5 0 0 1-2.6.525m0-1.334q2.233 0 3.783-1.55T13.333 8t-1.55-3.783T8 2.667t-3.783 1.55T2.667 8t1.55 3.783T8 13.333"
    />
  </svg>
);
export default SvgCheckCircle;
