import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const Svg30FpsSelect = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 18"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="30fps_select_svg__a"
      width={24}
      height={24}
      x={-3}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3-4h24v24H-3z" />
    </mask>
    <g mask="url(#30fps_select_svg__a)">
      <path
        fill="currentColor"
        d="M1 10V8h5V6H1V4h5V2H1V0h5q.824 0 1.412.588Q8 1.175 8 2v1.5q0 .65-.425 1.075T6.5 5q.65 0 1.075.425T8 6.5V8q0 .825-.588 1.412A1.93 1.93 0 0 1 6 10zm14 0h-3q-.825 0-1.412-.588A1.93 1.93 0 0 1 10 8V2q0-.824.588-1.412A1.93 1.93 0 0 1 12 0h3q.824 0 1.413.588Q17 1.175 17 2v6q0 .825-.587 1.412A1.93 1.93 0 0 1 15 10m0-2V2h-3v6zM0 18v-5h2v5zm4 0v-5h2v5zm4 0v-5h2v5zm4 0v-5h6v5z"
      />
    </g>
  </svg>
);
export default Svg30FpsSelect;
