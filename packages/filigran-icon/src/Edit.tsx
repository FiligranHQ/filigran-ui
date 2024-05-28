import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgEdit = ({
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
      id="edit_svg__a"
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
    <g mask="url(#edit_svg__a)">
      <path
        fill="currentColor"
        d="M2 16h1.425L13.2 6.225 11.775 4.8 2 14.575zm-2 2v-4.25L13.2.575q.3-.275.663-.425.361-.15.762-.15.4 0 .775.15t.65.45L17.425 2q.3.275.438.65a2.17 2.17 0 0 1 0 1.512 1.9 1.9 0 0 1-.438.663L4.25 18zM12.475 5.525l-.7-.725L13.2 6.225z"
      />
    </g>
  </svg>
);
export default SvgEdit;
