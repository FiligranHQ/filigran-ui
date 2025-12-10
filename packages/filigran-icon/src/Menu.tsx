import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgMenu = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 12"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="menu_svg__a"
      width={24}
      height={24}
      x={-3}
      y={-6}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3-6h24v24H-3z" />
    </mask>
    <g mask="url(#menu_svg__a)">
      <path fill="currentColor" d="M0 12v-2h18v2zm0-5V5h18v2zm0-5V0h18v2z" />
    </g>
  </svg>
);
export default SvgMenu;
