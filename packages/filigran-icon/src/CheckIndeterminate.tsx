import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCheckIndeterminate = ({
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
      id="check_indeterminate_svg__a"
      width={24}
      height={24}
      x={-2}
      y={-2}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-2-2h24v24H-2z" />
    </mask>
    <g mask="url(#check_indeterminate_svg__a)">
      <path
        fill="currentColor"
        d="M10 15q.424 0 .713-.287A.97.97 0 0 0 11 14a.97.97 0 0 0-.287-.713A.97.97 0 0 0 10 13a.97.97 0 0 0-.713.287A.97.97 0 0 0 9 14q0 .424.287.713Q9.576 15 10 15m-1-4h2V5H9zm1 9a9.7 9.7 0 0 1-3.9-.788 10.1 10.1 0 0 1-3.175-2.137Q1.575 15.725.788 13.9A9.7 9.7 0 0 1 0 10q0-2.074.788-3.9a10.1 10.1 0 0 1 2.137-3.175Q4.275 1.575 6.1.788A9.7 9.7 0 0 1 10 0q2.075 0 3.9.788a10.1 10.1 0 0 1 3.175 2.137q1.35 1.35 2.137 3.175A9.7 9.7 0 0 1 20 10a9.7 9.7 0 0 1-.788 3.9 10.1 10.1 0 0 1-2.137 3.175q-1.35 1.35-3.175 2.137A9.7 9.7 0 0 1 10 20m0-2q3.35 0 5.675-2.325T18 10t-2.325-5.675T10 2 4.325 4.325 2 10t2.325 5.675T10 18"
      />
    </g>
  </svg>
);
export default SvgCheckIndeterminate;
