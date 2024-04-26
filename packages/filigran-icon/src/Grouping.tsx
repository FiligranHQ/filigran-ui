import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgGrouping = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#grouping_svg__a)">
      <path
        fill="currentColor"
        d="M9.25 23.75c1.696 0 3.083 1.425 3.083 3.167s-1.387 3.166-3.083 3.166-3.083-1.425-3.083-3.166c0-1.742 1.387-3.167 3.083-3.167m0-3.167c-3.392 0-6.167 2.85-6.167 6.334S5.858 33.25 9.25 33.25s6.167-2.85 6.167-6.333-2.775-6.334-6.167-6.334M18.5 7.917c1.696 0 3.083 1.425 3.083 3.166 0 1.742-1.387 3.167-3.083 3.167s-3.083-1.425-3.083-3.167 1.387-3.166 3.083-3.166m0-3.167c-3.392 0-6.167 2.85-6.167 6.333s2.775 6.334 6.167 6.334 6.167-2.85 6.167-6.334S21.892 4.75 18.5 4.75m9.25 19c1.696 0 3.083 1.425 3.083 3.167s-1.387 3.166-3.083 3.166-3.083-1.425-3.083-3.166c0-1.742 1.387-3.167 3.083-3.167m0-3.167c-3.392 0-6.167 2.85-6.167 6.334s2.775 6.333 6.167 6.333 6.167-2.85 6.167-6.333-2.775-6.334-6.167-6.334"
      />
    </g>
    <defs>
      <clipPath id="grouping_svg__a">
        <path fill="#fff" d="M0 0h37v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgGrouping;
