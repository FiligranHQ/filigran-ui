import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgConstruction = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 35 35"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g fill="currentColor" clipPath="url(#construction_svg__a)">
      <path d="M23.193 19.032 20.1 22.126l8.744 8.744 3.094-3.093zM25.52 14.583a5.11 5.11 0 0 0 5.105-5.104c0-.846-.233-1.633-.598-2.333l-3.937 3.937-2.173-2.173 3.937-3.937c-.7-.365-1.487-.598-2.333-.598a5.11 5.11 0 0 0-5.104 5.104c0 .598.116 1.167.306 1.692l-2.698 2.698-2.596-2.596 1.036-1.035-2.057-2.057L17.5 5.09a4.374 4.374 0 0 0-6.183 0l-5.163 5.162 2.056 2.056H4.098l-1.035 1.036 5.162 5.162 1.035-1.035v-4.127l2.057 2.056 1.035-1.035 2.596 2.595L4.142 27.768l3.091 3.091 16.596-16.58c.525.189 1.094.305 1.692.305" />
    </g>
    <defs>
      <clipPath id="construction_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgConstruction;
