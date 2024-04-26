import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgOpinion = ({
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
    <g clipPath="url(#opinion_svg__a)">
      <path
        fill="currentColor"
        d="M31.667 3.167H6.333c-1.741 0-3.15 1.425-3.15 3.166l-.016 28.5L9.5 28.5h22.167a3.176 3.176 0 0 0 3.166-3.167v-19a3.176 3.176 0 0 0-3.166-3.166m0 22.166H8.186l-.934.934-.919.919V6.333h25.334zM17.417 19h3.166v3.167h-3.166zm0-9.5h3.166v6.333h-3.166z"
      />
    </g>
    <defs>
      <clipPath id="opinion_svg__a">
        <path fill="#fff" d="M0 0h38v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgOpinion;
