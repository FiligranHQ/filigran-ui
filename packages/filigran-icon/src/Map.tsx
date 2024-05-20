import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgMap = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#map_svg__a)">
      <path
        fill="currentColor"
        d="M18.5 3.083C9.99 3.083 3.083 9.99 3.083 18.5S9.99 33.917 18.5 33.917 33.917 27.01 33.917 18.5 27.01 3.083 18.5 3.083M6.167 18.5c0-.94.123-1.865.323-2.744l7.37 7.369v1.542a3.09 3.09 0 0 0 3.083 3.083v2.976C10.884 29.955 6.167 24.775 6.167 18.5m21.413 8.325c-.4-1.249-1.541-2.158-2.929-2.158H23.11v-4.625c0-.848-.694-1.542-1.542-1.542h-9.25v-3.083H15.4c.848 0 1.542-.694 1.542-1.542v-3.083h3.083a3.09 3.09 0 0 0 3.084-3.084v-.632c4.517 1.82 7.723 6.26 7.723 11.424a12.32 12.32 0 0 1-3.253 8.325"
      />
    </g>
    <defs>
      <clipPath id="map_svg__a">
        <path fill="#fff" d="M0 0h37v37H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgMap;
