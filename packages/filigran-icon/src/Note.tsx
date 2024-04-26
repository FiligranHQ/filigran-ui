import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgNote = ({
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
    <g clipPath="url(#note_svg__a)">
      <path
        fill="currentColor"
        d="M22.167 26.917H6.333v3.166h15.834zm9.5-12.667H6.333v3.167h25.334zm-25.334 9.5h25.334v-3.167H6.333zm0-15.833v3.166h25.334V7.917z"
      />
    </g>
    <defs>
      <clipPath id="note_svg__a">
        <path fill="#fff" d="M0 0h38v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgNote;
