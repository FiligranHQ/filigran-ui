import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgEvent = ({
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
      d="M18.5 18.5h7.708v7.708H18.5zM29.292 4.625H27.75V1.542h-3.083v3.083H12.333V1.542H9.25v3.083H7.708a3.09 3.09 0 0 0-3.083 3.083v21.584a3.09 3.09 0 0 0 3.083 3.083h21.584a3.09 3.09 0 0 0 3.083-3.083V7.708a3.09 3.09 0 0 0-3.083-3.083m0 3.083v3.084H7.708V7.708zM7.708 29.292V13.875h21.584v15.417z"
    />
  </svg>
);
export default SvgEvent;
