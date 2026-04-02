import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgOpenGrc = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g fill="currentColor" clipPath="url(#openGRC_svg__a)">
      <path
        fillRule="evenodd"
        d="M11.904.177 23.808 12.08 11.904 23.985 0 12.081zm0 1.977L1.977 12.08l9.927 9.927 9.927-9.927z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="m5.402 12.081 6.504-6.504 6.504 6.504-6.504 6.504zm1.977 0 4.527 4.527 4.527-4.527-4.527-4.527z"
        clipRule="evenodd"
      />
      <path d="m12.912 12.02-1.069-1.069-1.068 1.07 1.068 1.068z" />
    </g>
    <defs>
      <clipPath id="openGRC_svg__a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgOpenGrc;
