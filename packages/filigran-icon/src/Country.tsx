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
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#country_svg__a)">
      <path
        fill="currentColor"
        d="m12.36 6 .4 2H18v6h-3.36l-.4-2H7V6zM14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"
      />
    </g>
    <defs>
      <clipPath id="country_svg__a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgCountry;
