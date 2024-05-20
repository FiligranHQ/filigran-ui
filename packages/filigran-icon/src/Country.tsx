import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCountry = ({
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
    <g clipPath="url(#country_svg__a)">
      <path
        fill="currentColor"
        d="m19.055 9.25.617 3.083h8.078v9.25h-5.18l-.617-3.083H10.792V9.25zm2.528-3.083H7.708v26.208h3.084V21.583h8.633l.617 3.084h10.791V9.25H22.2z"
      />
    </g>
    <defs>
      <clipPath id="country_svg__a">
        <path fill="#fff" d="M0 0h37v37H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgCountry;
