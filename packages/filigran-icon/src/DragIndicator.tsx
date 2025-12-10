import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgDragIndicator = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 10 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="drag_indicator_svg__a"
      width={24}
      height={24}
      x={-7}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-7-4h24v24H-7z" />
    </mask>
    <g mask="url(#drag_indicator_svg__a)">
      <path
        fill="currentColor"
        d="M2 16q-.824 0-1.412-.588A1.93 1.93 0 0 1 0 14q0-.825.588-1.412A1.93 1.93 0 0 1 2 12q.824 0 1.413.588Q4 13.175 4 14t-.587 1.412A1.93 1.93 0 0 1 2 16m6 0q-.824 0-1.412-.588A1.93 1.93 0 0 1 6 14q0-.825.588-1.412A1.93 1.93 0 0 1 8 12q.825 0 1.412.588Q10 13.175 10 14t-.588 1.412A1.93 1.93 0 0 1 8 16m-6-6q-.824 0-1.412-.588A1.93 1.93 0 0 1 0 8q0-.824.588-1.412A1.93 1.93 0 0 1 2 6q.824 0 1.413.588Q4 7.175 4 8t-.587 1.412A1.93 1.93 0 0 1 2 10m6 0q-.824 0-1.412-.588A1.93 1.93 0 0 1 6 8q0-.824.588-1.412A1.93 1.93 0 0 1 8 6q.825 0 1.412.588Q10 7.175 10 8t-.588 1.412A1.93 1.93 0 0 1 8 10M2 4q-.824 0-1.412-.587A1.93 1.93 0 0 1 0 2Q0 1.176.588.588A1.93 1.93 0 0 1 2 0q.824 0 1.413.588Q4 1.175 4 2q0 .824-.587 1.413A1.93 1.93 0 0 1 2 4m6 0q-.824 0-1.412-.587A1.93 1.93 0 0 1 6 2q0-.824.588-1.412A1.93 1.93 0 0 1 8 0q.825 0 1.412.588Q10 1.175 10 2q0 .824-.588 1.413A1.93 1.93 0 0 1 8 4"
      />
    </g>
  </svg>
);
export default SvgDragIndicator;
