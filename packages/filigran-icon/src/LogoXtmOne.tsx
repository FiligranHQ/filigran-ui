import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLogoXtmOne = ({
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
    <g fill="currentColor" clipPath="url(#LogoXTMOne_svg__a)">
      <path d="m17.069 10.882 5.358-5.621-1.186-1.245-7.385 7.746 4.314 4.525 1.187-1.245-2.288-2.4h6.85v-1.76zM16.26 6.029l-1.188-1.244-2.287 2.399V0h-1.679v7.184l-5.825-6.11-1.187 1.244 7.851 8.235zM5.75 7.684 4.561 8.928l2.289 2.4H0v1.76h6.85l-5.748 6.029 1.187 1.244 7.775-8.153zM7.66 17.94l1.187 1.245 2.287-2.4v7.185h1.68v-7.185l5.89 6.18 1.187-1.245-7.917-8.303z" />
    </g>
    <defs>
      <clipPath id="LogoXTMOne_svg__a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgLogoXtmOne;
