import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgReport = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 25 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#report_svg__a)">
      <path
        fill="currentColor"
        d="M8.216 16h8.216v2H8.216zm0-4h8.216v2H8.216zm6.162-10H6.162c-1.13 0-2.054.9-2.054 2v16c0 1.1.914 2 2.044 2h12.334c1.13 0 2.055-.9 2.055-2V8zm4.108 18H6.163V4h7.19v5h5.134z"
      />
    </g>
    <defs>
      <clipPath id="report_svg__a">
        <path fill="#fff" d="M0 0h24.649v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgReport;
