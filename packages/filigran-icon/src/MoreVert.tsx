import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgMoreVert = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 3 15"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="more_vert_svg__a"
      width={25}
      height={25}
      x={-11}
      y={-5}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-10.5-4.731h24v24h-24z" />
    </mask>
    <g mask="url(#more_vert_svg__a)">
      <path
        fill="currentColor"
        d="M1.5 14.539q-.62 0-1.06-.441a1.44 1.44 0 0 1-.44-1.06q0-.618.44-1.059.442-.44 1.06-.44.62 0 1.06.44t.44 1.06q0 .618-.44 1.059t-1.06.44m0-5.77q-.62 0-1.06-.44A1.44 1.44 0 0 1 0 7.268q0-.618.44-1.059.442-.44 1.06-.44.62 0 1.06.44T3 7.27q0 .618-.44 1.059t-1.06.44M1.5 3Q.88 3 .44 2.56A1.45 1.45 0 0 1 0 1.5Q0 .88.44.44.883 0 1.5 0q.62 0 1.06.44Q3 .883 3 1.5q0 .62-.44 1.06T1.5 3"
      />
    </g>
  </svg>
);
export default SvgMoreVert;
