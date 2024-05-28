import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgAttackPattern = ({
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
      d="M7 3a4 4 0 0 1 4 4c0 1.86-1.27 3.43-3 3.87v2.26c.37.09.72.24 1.04.43l4.52-4.52A4 4 0 1 1 17 11c-.74 0-1.43-.2-2-.55L10.45 15c.35.57.55 1.26.55 2a4 4 0 1 1-5-3.87v-2.26C4.27 10.43 3 8.86 3 7a4 4 0 0 1 4-4m10 10a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
    />
  </svg>
);
export default SvgAttackPattern;
