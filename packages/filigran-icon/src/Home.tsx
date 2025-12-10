import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgHome = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 18"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="home_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-3}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-3h24v24H-4z" />
    </mask>
    <g mask="url(#home_svg__a)">
      <path
        fill="currentColor"
        d="M2 16h3v-6h6v6h3V7L8 2.5 2 7zm-2 2V6l8-6 8 6v12H9v-6H7v6z"
      />
    </g>
  </svg>
);
export default SvgHome;
