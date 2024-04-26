import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgAttackPattern = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 38 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M11.083 4.75a6.334 6.334 0 0 1 6.334 6.333 6.32 6.32 0 0 1-4.75 6.128v3.578c.585.143 1.14.38 1.646.681l7.157-7.157a6.2 6.2 0 0 1-.887-3.23 6.333 6.333 0 1 1 6.334 6.334 6.05 6.05 0 0 1-3.167-.871l-7.204 7.204c.554.902.87 1.995.87 3.167a6.333 6.333 0 0 1-12.666 0 6.32 6.32 0 0 1 4.75-6.128v-3.578a6.32 6.32 0 0 1-4.75-6.128 6.333 6.333 0 0 1 6.333-6.333m15.834 15.833a6.333 6.333 0 1 1 0 12.667 6.333 6.333 0 0 1 0-12.667m0 3.167a3.167 3.167 0 1 0 0 6.333 3.167 3.167 0 0 0 0-6.333"
    />
  </svg>
);
export default SvgAttackPattern;
