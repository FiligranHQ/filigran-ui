import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgAssignment = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 35 35"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#assignment_svg__a)">
      <path
        fill="currentColor"
        d="M27.708 4.375h-6.095C21 2.683 19.396 1.458 17.5 1.458S14 2.683 13.387 4.375H7.292a2.925 2.925 0 0 0-2.917 2.917v20.416a2.925 2.925 0 0 0 2.917 2.917h20.416a2.925 2.925 0 0 0 2.917-2.917V7.292a2.925 2.925 0 0 0-2.917-2.917m-10.208 0c.802 0 1.458.656 1.458 1.458s-.656 1.459-1.458 1.459a1.463 1.463 0 0 1-1.458-1.459c0-.802.656-1.458 1.458-1.458m2.917 20.417H10.208v-2.917h10.209zm4.375-5.834H10.208v-2.916h14.584zm0-5.833H10.208v-2.917h14.584z"
      />
    </g>
    <defs>
      <clipPath id="assignment_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgAssignment;
