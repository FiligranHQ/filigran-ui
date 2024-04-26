import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgDashboard = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 32 29"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#dashboard_svg__a)">
      <path
        fill="currentColor"
        d="M3.952 15.708H14.49V3.625H3.952zm0 9.667H14.49v-7.25H3.952zm13.173 0h10.539V13.292H17.124zm0-21.75v7.25h10.539v-7.25z"
      />
    </g>
    <defs>
      <clipPath id="dashboard_svg__a">
        <path fill="#fff" d="M0 0h31.616v29H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgDashboard;
