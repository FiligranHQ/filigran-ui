import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgDashboard = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 27 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#dashboard_svg__a)">
      <path
        fill="currentColor"
        d="M3.27 13h8.722V3H3.271zm0 8h8.722v-6H3.271zm10.902 0h8.722V11h-8.722zm0-18v6h8.722V3z"
      />
    </g>
    <defs>
      <clipPath id="dashboard_svg__a">
        <path fill="#fff" d="M0 0h26.165v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgDashboard;
