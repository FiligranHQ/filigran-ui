import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCaseRfi = ({
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
      d="M15.833 3.167h6.334a3.166 3.166 0 0 1 3.166 3.166V9.5h6.334a3.166 3.166 0 0 1 3.166 3.167v7.964c-.791-1.267-1.9-2.36-3.166-3.214v-4.75H6.333v17.416h10.292a10.4 10.4 0 0 0 2.074 3.167H6.333a3.166 3.166 0 0 1-3.166-3.167V12.667A3.156 3.156 0 0 1 6.333 9.5h6.334V6.333a3.156 3.156 0 0 1 3.166-3.166M22.167 9.5V6.333h-6.334V9.5zm9.99 20.425 4.877 4.908-2.2 2.201-4.94-4.86a7.1 7.1 0 0 1-3.769 1.076A7.095 7.095 0 0 1 19 26.125 7.095 7.095 0 0 1 26.125 19a7.095 7.095 0 0 1 7.125 7.125 7.06 7.06 0 0 1-1.093 3.8m-6.032.158a3.958 3.958 0 1 0 0-7.916 3.958 3.958 0 0 0 0 7.916"
    />
  </svg>
);
export default SvgCaseRfi;
