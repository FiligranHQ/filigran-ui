import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgPosition = ({
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
    <g clipPath="url(#position_svg__a)">
      <path
        fill="currentColor"
        d="M19 19a3.176 3.176 0 0 1-3.167-3.167A3.176 3.176 0 0 1 19 12.667a3.176 3.176 0 0 1 3.167 3.166A3.176 3.176 0 0 1 19 19m9.5-2.85c0-5.747-4.196-9.817-9.5-9.817s-9.5 4.07-9.5 9.817c0 3.705 3.088 8.613 9.5 14.472 6.413-5.859 9.5-10.767 9.5-14.472M19 3.167c6.65 0 12.667 5.098 12.667 12.983 0 5.257-4.228 11.48-12.667 18.683C10.56 27.63 6.333 21.407 6.333 16.15 6.333 8.265 12.35 3.167 19 3.167"
      />
    </g>
    <defs>
      <clipPath id="position_svg__a">
        <path fill="#fff" d="M0 0h38v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgPosition;
