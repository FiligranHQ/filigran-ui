import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgRelationship = ({
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
      d="M3.083 6.167h3.084V3.083h9.25v3.084a15.417 15.417 0 0 1 15.416 15.416h3.084v9.25h-3.084v3.084H27.75v-3.084h-3.083v-9.25h3.083A12.333 12.333 0 0 0 15.417 9.25v3.083h-9.25V9.25H3.083zm24.667 18.5v3.083h3.083v-3.083zm-18.5-18.5V9.25h3.083V6.167z"
    />
  </svg>
);
export default SvgRelationship;
