import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgIndividual = ({
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
    <g clipPath="url(#individual_svg__a)">
      <path
        fill="currentColor"
        d="M19 9.5a3.176 3.176 0 0 1 3.167 3.167A3.176 3.176 0 0 1 19 15.833a3.176 3.176 0 0 1-3.167-3.166A3.176 3.176 0 0 1 19 9.5m0 15.833c4.275 0 9.183 2.043 9.5 3.167h-19c.364-1.14 5.24-3.167 9.5-3.167m0-19a6.33 6.33 0 0 0-6.333 6.334C12.667 16.166 15.5 19 19 19s6.333-2.834 6.333-6.333S22.5 6.333 19 6.333m0 15.834c-4.227 0-12.667 2.121-12.667 6.333v3.167h25.334V28.5c0-4.212-8.44-6.333-12.667-6.333"
      />
    </g>
    <defs>
      <clipPath id="individual_svg__a">
        <path fill="#fff" d="M0 0h38v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgIndividual;
