import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgMotionPlay = ({
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
    <mask
      id="motion_play_svg__a"
      width={24}
      height={24}
      x={0}
      y={0}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M0 0h24v24H0z" />
    </mask>
    <g mask="url(#motion_play_svg__a)">
      <path
        fill="currentColor"
        d="m10 16 6-4-6-4zm2 6a9.7 9.7 0 0 1-3.9-.788 10.1 10.1 0 0 1-3.175-2.137q-1.35-1.35-2.137-3.175A9.7 9.7 0 0 1 2 12q0-1.075.225-2.113a10.7 10.7 0 0 1 .65-2.012l1.55 1.55q-.2.65-.312 1.287A7.4 7.4 0 0 0 4 12q0 3.35 2.325 5.675T12 20t5.675-2.325T20 12t-2.325-5.675T12 4q-.675 0-1.312.112a10 10 0 0 0-1.263.313L7.9 2.9q1-.45 2-.675A9.5 9.5 0 0 1 12 2q2.075 0 3.9.788a10.1 10.1 0 0 1 3.175 2.137q1.35 1.35 2.137 3.175A9.7 9.7 0 0 1 22 12a9.7 9.7 0 0 1-.788 3.9 10.1 10.1 0 0 1-2.137 3.175q-1.35 1.35-3.175 2.137A9.7 9.7 0 0 1 12 22M5.5 7q-.625 0-1.062-.437A1.45 1.45 0 0 1 4 5.5q0-.625.438-1.062A1.45 1.45 0 0 1 5.5 4q.624 0 1.063.438Q7 4.874 7 5.5q0 .624-.437 1.063A1.45 1.45 0 0 1 5.5 7"
      />
    </g>
  </svg>
);
export default SvgMotionPlay;
