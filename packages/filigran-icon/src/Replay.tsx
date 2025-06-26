import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgReplay = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 21"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="replay_svg__a"
      width={24}
      height={24}
      x={-3}
      y={-1}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3-1h24v24H-3z" />
    </mask>
    <g mask="url(#replay_svg__a)">
      <path
        fill="currentColor"
        d="M9 21q-1.874 0-3.512-.712a9.2 9.2 0 0 1-2.85-1.925 9.2 9.2 0 0 1-1.925-2.85A8.7 8.7 0 0 1 0 12h2q0 2.925 2.037 4.962T9 19t4.963-2.038T16 12t-2.037-4.962T9 5h-.15l1.55 1.55L9 8 5 4l4-4 1.4 1.45L8.85 3H9q1.874 0 3.512.712a9.2 9.2 0 0 1 2.85 1.926 9.2 9.2 0 0 1 1.926 2.85A8.7 8.7 0 0 1 18 12q0 1.874-.712 3.512a9.2 9.2 0 0 1-1.925 2.85 9.2 9.2 0 0 1-2.85 1.926A8.7 8.7 0 0 1 9 21"
      />
    </g>
  </svg>
);
export default SvgReplay;
