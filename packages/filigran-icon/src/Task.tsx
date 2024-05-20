import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgTask = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 38 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M19 33.917q-3.365 0-6.254-1.176-2.89-1.176-5.027-3.257a15 15 0 0 1-3.345-4.894q-1.207-2.814-1.207-6.09 0-3.237 1.207-6.051a15 15 0 0 1 3.345-4.895q2.137-2.081 5.027-3.276Q15.635 3.083 19 3.083q2.969 0 5.542.925a16.4 16.4 0 0 1 4.63 2.544L27.472 8.21a13.4 13.4 0 0 0-3.88-2.08Q21.455 5.395 19 5.395q-5.74 0-9.599 3.758T5.541 18.5t3.86 9.346T19 31.604t9.599-3.758 3.86-9.346q0-1.155-.179-2.255a13 13 0 0 0-.534-2.139l1.82-1.773q.635 1.426.95 2.968.318 1.542.317 3.199 0 3.276-1.227 6.09a15.3 15.3 0 0 1-3.364 4.894q-2.138 2.081-5.027 3.257T19 33.917m-2.335-8.402-6.532-6.398 1.782-1.735 4.75 4.625L33.052 6.051l1.82 1.734z"
    />
  </svg>
);
export default SvgTask;
