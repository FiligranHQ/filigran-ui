import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCaseRft = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M15.417 3.167h6.166c.818 0 1.602.333 2.18.927s.904 1.4.904 2.24V9.5h6.166c.818 0 1.602.334 2.18.928.579.593.904 1.399.904 2.239v8.756a8.8 8.8 0 0 0-3.084-1.885v-6.871H6.167v17.416h12.456c.185 1.14.57 2.201 1.11 3.167H6.167a3.04 3.04 0 0 1-2.18-.928 3.2 3.2 0 0 1-.904-2.239V12.667c0-.84.325-1.646.903-2.24a3.04 3.04 0 0 1 2.18-.927h6.167V6.333c0-.84.325-1.645.903-2.239a3.04 3.04 0 0 1 2.18-.927M21.583 9.5V6.333h-6.166V9.5zm.71 15.643 2.189-2.248 3.268 3.372 3.268-3.372 2.19 2.248-3.284 3.357 3.284 3.357-2.19 2.248-3.268-3.372-3.268 3.372-2.19-2.248 3.284-3.357z"
    />
  </svg>
);
export default SvgCaseRft;
