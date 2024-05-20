import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLayersBlack = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 35 35"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#layers_black_svg__a)">
      <path
        fill="currentColor"
        d="M17.485 27.038 6.738 18.68 4.375 20.52 17.5 30.727l13.125-10.208-2.377-1.852zm.015-3.705 10.733-8.356 2.392-1.852L17.5 2.917 4.375 13.125l2.377 1.852z"
      />
    </g>
    <defs>
      <clipPath id="layers_black_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgLayersBlack;
