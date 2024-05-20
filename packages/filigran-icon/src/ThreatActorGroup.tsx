import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgThreatActorGroup = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M20.15 16.049a7.71 7.71 0 0 0 0-8.973 5.23 5.23 0 0 1 2.975-.91 5.396 5.396 0 1 1 0 10.792 5.23 5.23 0 0 1-2.975-.91M8.48 11.563a5.396 5.396 0 1 1 10.79 0 5.396 5.396 0 0 1-10.79 0m3.082 0a2.313 2.313 0 1 0 4.626 0 2.313 2.313 0 0 0-4.625 0m13.105 14.645v3.084H3.083v-3.084s0-6.166 10.792-6.166 10.792 6.166 10.792 6.166m-3.084 0c-.215-1.202-2.05-3.083-7.708-3.083s-7.6 2.02-7.708 3.083m18.423-6.166a8.2 8.2 0 0 1 3.16 6.166v3.084h6.167v-3.084s0-5.596-9.343-6.166z"
    />
  </svg>
);
export default SvgThreatActorGroup;
