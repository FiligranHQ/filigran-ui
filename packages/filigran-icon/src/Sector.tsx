import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgSector = ({
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
    <g clipPath="url(#sector_svg__a)">
      <path
        fill="currentColor"
        d="M18.5 10.792V4.625H3.083v27.75h30.834V10.792zm-9.25 18.5H6.167v-3.084H9.25zm0-6.167H6.167v-3.083H9.25zm0-6.167H6.167v-3.083H9.25zm0-6.166H6.167V7.708H9.25zm6.167 18.5h-3.084v-3.084h3.084zm0-6.167h-3.084v-3.083h3.084zm0-6.167h-3.084v-3.083h3.084zm0-6.166h-3.084V7.708h3.084zm15.416 18.5H18.5v-3.084h3.083v-3.083H18.5v-3.083h3.083v-3.084H18.5v-3.083h12.333zM27.75 16.958h-3.083v3.084h3.083zm0 6.167h-3.083v3.083h3.083z"
      />
    </g>
    <defs>
      <clipPath id="sector_svg__a">
        <path fill="#fff" d="M0 0h37v37H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgSector;
