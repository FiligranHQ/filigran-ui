import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgForum = ({
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
      id="forum_svg__a"
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
    <g mask="url(#forum_svg__a)">
      <path
        fill="currentColor"
        d="M5 16a.97.97 0 0 1-.713-.287A.97.97 0 0 1 4 15v-2h13V4h2q.424 0 .712.287Q20 4.576 20 5v15l-4-4zm-5-1V1Q0 .576.288.288A.97.97 0 0 1 1 0h13q.424 0 .713.288Q15 .575 15 1v9q0 .424-.287.713A.97.97 0 0 1 14 11H4zm13-6V2H2v7z"
      />
    </g>
  </svg>
);
export default SvgForum;
