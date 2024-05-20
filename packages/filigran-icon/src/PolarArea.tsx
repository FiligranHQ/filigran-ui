import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgPolarArea = ({
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
      d="M19.5 7.5v11.667l2.917-2.083 7.084-4.167c-.417-.694-2.084-2.5-3.75-4.167-1.667-1.666-4.723-1.25-6.25-1.25"
    />
    <path
      fill="currentColor"
      d="M19.084 19.167v-7.493c-4.076.146-6.412 2.4-7.084 3.546l4.167 2.368z"
      opacity={0.5}
    />
    <circle cx={19.5} cy={19.167} r={12} stroke="currentColor" />
    <circle cx={19.5} cy={19.167} r={7.834} stroke="currentColor" />
    <circle
      cx={19.084}
      cy={18.75}
      r={17.084}
      stroke="currentColor"
      strokeWidth={3}
    />
    <path
      stroke="currentColor"
      d="M19.5 1v36M34.743 10.438 3.933 27.521M34.249 27.933 3.439 10.016"
    />
  </svg>
);
export default SvgPolarArea;
