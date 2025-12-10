import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgAdd = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 14 14"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="add_svg__a"
      width={24}
      height={24}
      x={-5}
      y={-5}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-5-5h24v24H-5z" />
    </mask>
    <g mask="url(#add_svg__a)">
      <path fill="currentColor" d="M6 8H0V6h6V0h2v6h6v2H8v6H6z" />
    </g>
  </svg>
);
export default SvgAdd;
