import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgGroup = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 22 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="group_svg__a"
      width={24}
      height={24}
      x={-1}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-1-4h24v24H-1z" />
    </mask>
    <g mask="url(#group_svg__a)">
      <path
        fill="currentColor"
        d="M0 16v-2.8q0-.85.438-1.562.437-.713 1.162-1.088a15 15 0 0 1 3.15-1.163A13.8 13.8 0 0 1 8 9q1.65 0 3.25.387 1.6.388 3.15 1.163.724.375 1.162 1.087Q16 12.35 16 13.2V16zm18 0v-3q0-1.1-.613-2.113-.612-1.012-1.737-1.737 1.275.15 2.4.512 1.125.363 2.1.888.9.5 1.375 1.112Q22 12.277 22 13v3zM8 8Q6.35 8 5.175 6.825T4 4t1.175-2.825T8 0t2.825 1.175T12 4t-1.175 2.825T8 8m10-4q0 1.65-1.175 2.825T14 8q-.275 0-.7-.062a6 6 0 0 1-.7-.138 6 6 0 0 0 1.037-1.775Q14 5.05 14 4t-.363-2.025A6 6 0 0 0 12.6.2a3 3 0 0 1 .7-.162Q13.65 0 14 0q1.65 0 2.825 1.175T18 4M2 14h12v-.8a.973.973 0 0 0-.5-.85q-1.35-.675-2.725-1.012a11.6 11.6 0 0 0-5.55 0Q3.85 11.675 2.5 12.35a.97.97 0 0 0-.5.85zm6-8q.825 0 1.412-.588Q10 4.826 10 4q0-.824-.588-1.412A1.93 1.93 0 0 0 8 2q-.824 0-1.412.587A1.93 1.93 0 0 0 6 4q0 .824.588 1.412Q7.175 6 8 6"
      />
    </g>
  </svg>
);
export default SvgGroup;
