import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgDownload = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="download_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-4h24v24H-4z" />
    </mask>
    <g mask="url(#download_svg__a)">
      <path
        fill="currentColor"
        d="M8 12 3 7l1.4-1.45L7 8.15V0h2v8.15l2.6-2.6L13 7zm-6 4q-.824 0-1.412-.588A1.93 1.93 0 0 1 0 14v-3h2v3h12v-3h2v3q0 .825-.588 1.412A1.93 1.93 0 0 1 14 16z"
      />
    </g>
  </svg>
);
export default SvgDownload;
