import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgMoon = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="moon_svg__a"
      width={24}
      height={24}
      x={-3}
      y={-3}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3-3h24v24H-3z" />
    </mask>
    <g mask="url(#moon_svg__a)">
      <path
        fill="currentColor"
        d="M9 18q-3.75 0-6.375-2.625T0 9t2.625-6.375T9 0a9 9 0 0 1 1.35.1 5.3 5.3 0 0 0-1.637 1.888A5.3 5.3 0 0 0 8.1 4.5q0 2.25 1.575 3.825T13.5 9.9q1.375 0 2.525-.613A5.3 5.3 0 0 0 17.9 7.65 8.5 8.5 0 0 1 18 9q0 3.75-2.625 6.375T9 18m0-2q2.2 0 3.95-1.213a7 7 0 0 0 2.55-3.162q-.5.125-1 .2t-1 .075q-3.075 0-5.238-2.162Q6.1 7.575 6.1 4.5q0-.5.075-1t.2-1a7 7 0 0 0-3.162 2.55Q2 6.8 2 9q0 2.9 2.05 4.95T9 16"
      />
    </g>
  </svg>
);
export default SvgMoon;
