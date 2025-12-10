import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgSun = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 22 22"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="sun_svg__a"
      width={24}
      height={24}
      x={-1}
      y={-1}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-1-1h24v24H-1z" />
    </mask>
    <g mask="url(#sun_svg__a)">
      <path
        fill="currentColor"
        d="M10 3V0h2v3zm0 19v-3h2v3zm9-10v-2h3v2zM0 12v-2h3v2zm17.7-6.3-1.4-1.4 1.75-1.8 1.45 1.45zM3.95 19.5 2.5 18.05l1.8-1.75 1.4 1.4zm14.1 0-1.75-1.8 1.4-1.4 1.8 1.75zM4.3 5.7 2.5 3.95 3.95 2.5 5.7 4.3zM11 17q-2.5 0-4.25-1.75T5 11t1.75-4.25T11 5t4.25 1.75T17 11t-1.75 4.25T11 17m0-2q1.675 0 2.838-1.162Q15 12.676 15 11q0-1.675-1.162-2.838Q12.676 7 11 7 9.325 7 8.162 8.162 7 9.325 7 11q0 1.675 1.162 2.838Q9.325 15 11 15"
      />
    </g>
  </svg>
);
export default SvgSun;
