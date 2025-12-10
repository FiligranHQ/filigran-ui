import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgShare = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 20"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="share_svg__a"
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
    <g mask="url(#share_svg__a)">
      <path
        fill="currentColor"
        d="M15 20a2.9 2.9 0 0 1-2.125-.875A2.9 2.9 0 0 1 12 17q0-.15.075-.7L5.05 12.2A2.97 2.97 0 0 1 3 13a2.9 2.9 0 0 1-2.125-.875A2.9 2.9 0 0 1 0 10q0-1.25.875-2.125A2.9 2.9 0 0 1 3 7a2.97 2.97 0 0 1 2.05.8l7.025-4.1a1.7 1.7 0 0 1-.062-.338A5 5 0 0 1 12 3q0-1.25.875-2.125A2.9 2.9 0 0 1 15 0q1.25 0 2.125.875T18 3t-.875 2.125A2.9 2.9 0 0 1 15 6a2.97 2.97 0 0 1-2.05-.8L5.925 9.3q.05.176.063.337Q6 9.801 6 10q0 .2-.013.363t-.062.337l7.025 4.1A2.97 2.97 0 0 1 15 14q1.25 0 2.125.875T18 17t-.875 2.125A2.9 2.9 0 0 1 15 20m0-2q.424 0 .713-.288A.97.97 0 0 0 16 17a.97.97 0 0 0-.287-.712A.97.97 0 0 0 15 16a.97.97 0 0 0-.713.288A.97.97 0 0 0 14 17q0 .424.287.712.288.288.713.288M3 11q.424 0 .712-.287A.97.97 0 0 0 4 10a.97.97 0 0 0-.288-.713A.97.97 0 0 0 3 9a.97.97 0 0 0-.712.287A.97.97 0 0 0 2 10q0 .424.288.713Q2.575 11 3 11m12-7q.424 0 .713-.288A.97.97 0 0 0 16 3a.97.97 0 0 0-.287-.712A.97.97 0 0 0 15 2a.97.97 0 0 0-.713.288A.97.97 0 0 0 14 3q0 .424.287.712Q14.576 4 15 4"
      />
    </g>
  </svg>
);
export default SvgShare;
