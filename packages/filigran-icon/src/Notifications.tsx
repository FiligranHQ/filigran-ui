import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgNotifications = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 20"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="notifications_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-2}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-2h24v24H-4z" />
    </mask>
    <g mask="url(#notifications_svg__a)">
      <path
        fill="currentColor"
        d="M0 17v-2h2V8q0-2.075 1.25-3.687Q4.5 2.7 6.5 2.2v-.7q0-.625.438-1.062A1.45 1.45 0 0 1 8 0q.624 0 1.063.438Q9.5.874 9.5 1.5v.7q2 .5 3.25 2.113T14 8v7h2v2zm8 3q-.824 0-1.412-.587A1.93 1.93 0 0 1 6 18h4q0 .824-.588 1.413A1.93 1.93 0 0 1 8 20m-4-5h8V8q0-1.65-1.175-2.825T8 4 5.175 5.175 4 8z"
      />
    </g>
  </svg>
);
export default SvgNotifications;
