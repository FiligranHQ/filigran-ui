import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLabel = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M24.667 26.208H7.708V10.792h16.959L30.14 18.5m-2.96-9.497a3.07 3.07 0 0 0-2.513-1.295H7.708a3.083 3.083 0 0 0-3.083 3.084v15.416a3.083 3.083 0 0 0 3.083 3.084h16.959a3.09 3.09 0 0 0 2.513-1.31l6.737-9.482z"
    />
  </svg>
);
export default SvgLabel;
