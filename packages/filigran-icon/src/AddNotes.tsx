import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgAddNotes = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 20 20"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="add_notes_svg__a"
      width={24}
      height={24}
      x={-3}
      y={-3}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3-3h24v24H-3z" />
    </mask>
    <g mask="url(#add_notes_svg__a)">
      <path
        fill="currentColor"
        d="M2 18q-.824 0-1.412-.587A1.93 1.93 0 0 1 0 16V2Q0 1.176.588.588A1.93 1.93 0 0 1 2 0h14q.824 0 1.413.588Q18 1.175 18 2v6.7a8 8 0 0 0-.975-.387A6 6 0 0 0 16 8.075V2H2v14h6.05q.076.55.237 1.05.163.5.388.95zm0-2V2v6.075V8zm2-2h4.075q.076-.525.238-1.025T8.675 12H4zm0-4h6.1q.8-.75 1.787-1.25A7 7 0 0 1 14 8.075V8H4zm0-4h10V4H4zm11 14q-2.075 0-3.537-1.462Q10 17.074 10 15q0-2.075 1.463-3.537Q12.926 10 15 10q2.075 0 3.538 1.463T20 15t-1.462 3.538Q17.074 20 15 20m-.5-2h1v-2.5H18v-1h-2.5V12h-1v2.5H12v1h2.5z"
      />
    </g>
  </svg>
);
export default SvgAddNotes;
