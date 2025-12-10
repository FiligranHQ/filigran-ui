import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgOpenInNew = ({
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
      id="open_in_new_svg__a"
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
    <g mask="url(#open_in_new_svg__a)">
      <path
        fill="currentColor"
        d="M2 18q-.824 0-1.412-.587A1.93 1.93 0 0 1 0 16V2Q0 1.176.588.588A1.93 1.93 0 0 1 2 0h7v2H2v14h14V9h2v7q0 .824-.587 1.413A1.93 1.93 0 0 1 16 18zm4.7-5.3-1.4-1.4L14.6 2H11V0h7v7h-2V3.4z"
      />
    </g>
  </svg>
);
export default SvgOpenInNew;
