import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgVisibilityOff = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 22 20"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="visibility_off_svg__a"
      width={24}
      height={25}
      x={-1}
      y={-3}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-1-2.8h24v24H-1z" />
    </mask>
    <g mask="url(#visibility_off_svg__a)">
      <path
        fill="currentColor"
        d="m15.1 10.5-1.45-1.45q.225-1.175-.675-2.2t-2.325-.8L9.2 4.6q.424-.2.863-.3A4.2 4.2 0 0 1 11 4.2q1.875 0 3.188 1.313Q15.5 6.825 15.5 8.7q0 .5-.1.938t-.3.862m3.2 3.15-1.45-1.4a11 11 0 0 0 1.688-1.588A9 9 0 0 0 19.8 8.7q-1.25-2.524-3.588-4.012T11 3.2q-.725 0-1.425.1a10 10 0 0 0-1.375.3L6.65 2.05A11.1 11.1 0 0 1 11 1.2q3.775 0 6.725 2.088Q20.675 5.374 22 8.7a11.7 11.7 0 0 1-1.512 2.738A11 11 0 0 1 18.3 13.65m.5 6.15-4.2-4.15q-.874.274-1.762.412T11 16.2q-3.775 0-6.725-2.087T0 8.7q.525-1.325 1.325-2.462A11.5 11.5 0 0 1 3.15 4.2L.4 1.4 1.8 0l18.4 18.4zM4.55 5.6q-.725.65-1.325 1.425A9 9 0 0 0 2.2 8.7q1.25 2.524 3.587 4.013Q8.125 14.2 11 14.2q.5 0 .975-.062.475-.063.975-.138l-.9-.95q-.274.075-.525.112A3.5 3.5 0 0 1 11 13.2q-1.875 0-3.187-1.312Q6.5 10.574 6.5 8.7q0-.274.037-.525.038-.25.113-.525z"
      />
    </g>
  </svg>
);
export default SvgVisibilityOff;
