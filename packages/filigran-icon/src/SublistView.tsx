import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgSublistView = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 20 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="sublist_view_svg__a"
      width={24}
      height={24}
      x={-2}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-2-4h24v24H-2z" />
    </mask>
    <g mask="url(#sublist_view_svg__a)">
      <path
        fill="currentColor"
        d="M4 16v-4h4v4zm6 0v-4h10v4zm-6-6V6h4v4zm6 0V6h10v4zM0 4V0h4v4zm6 0V0h14v4z"
      />
    </g>
  </svg>
);
export default SvgSublistView;
