import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgNarrative = ({
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
      d="M30.833 3.167H6.167c-.818 0-1.602.333-2.18.927a3.2 3.2 0 0 0-.904 2.24v28.5L9.25 28.5h21.583c.818 0 1.602-.334 2.18-.927.579-.594.904-1.4.904-2.24v-19a3.2 3.2 0 0 0-.903-2.239 3.04 3.04 0 0 0-2.18-.927m-18.5 19H9.25V19h3.083zm0-4.75H9.25V14.25h3.083zm0-4.75H9.25V9.5h3.083zm10.792 9.5h-7.708V19h7.708zm4.625-4.75H15.417V14.25H27.75zm0-4.75H15.417V9.5H27.75z"
    />
  </svg>
);
export default SvgNarrative;
