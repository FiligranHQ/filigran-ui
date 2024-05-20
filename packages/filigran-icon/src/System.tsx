import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgSystem = ({
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
      d="M6.167 1.542h24.666a1.54 1.54 0 0 1 1.542 1.541V9.25a1.54 1.54 0 0 1-1.542 1.542H6.167A1.54 1.54 0 0 1 4.625 9.25V3.083a1.54 1.54 0 0 1 1.542-1.541m0 12.333h24.666a1.54 1.54 0 0 1 1.542 1.542v6.166a1.54 1.54 0 0 1-1.542 1.542H6.167a1.54 1.54 0 0 1-1.542-1.542v-6.166a1.54 1.54 0 0 1 1.542-1.542m0 12.333h24.666a1.54 1.54 0 0 1 1.542 1.542v6.167a1.54 1.54 0 0 1-1.542 1.541H6.167a1.54 1.54 0 0 1-1.542-1.541V27.75a1.54 1.54 0 0 1 1.542-1.542m7.708-18.5h1.542V4.625h-1.542zm0 12.334h1.542v-3.084h-1.542zm0 12.333h1.542v-3.083h-1.542zM7.708 4.625v3.083h3.084V4.625zm0 12.333v3.084h3.084v-3.084zm0 12.334v3.083h3.084v-3.083z"
    />
  </svg>
);
export default SvgSystem;
