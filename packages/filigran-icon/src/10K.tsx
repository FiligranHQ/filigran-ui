import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const Svg10K = ({
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
      id="10k_svg__a"
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
    <g mask="url(#10k_svg__a)">
      <path
        fill="currentColor"
        d="M3 12h1.5V6H2v1.5h1zm3.5 0H9q.424 0 .713-.287A.97.97 0 0 0 10 11V7a.97.97 0 0 0-.287-.713A.97.97 0 0 0 9 6H6.5a.97.97 0 0 0-.713.287A.97.97 0 0 0 5.5 7v4q0 .424.287.713.288.287.713.287m.5-1.5v-3h1.5v3zm3.925 1.5h1.5V9.75l1.75 2.25H16l-2.325-3L16 6h-1.825l-1.75 2.25V6h-1.5zM2 18q-.824 0-1.412-.587A1.93 1.93 0 0 1 0 16V2Q0 1.176.588.588A1.93 1.93 0 0 1 2 0h14q.824 0 1.413.588Q18 1.175 18 2v14q0 .824-.587 1.413A1.93 1.93 0 0 1 16 18zm0-2h14V2H2z"
      />
    </g>
  </svg>
);
export default Svg10K;
