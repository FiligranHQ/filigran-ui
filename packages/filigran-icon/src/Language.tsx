import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgLanguage = ({
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
      d="m20.378 23.233-4.022-3.87.047-.046c2.755-2.99 4.719-6.429 5.875-10.067h4.639V6.167H15.833V3.083h-3.166v3.084H1.583V9.25H19.27a24.2 24.2 0 0 1-5.019 8.248 24 24 0 0 1-3.658-5.165H7.426a27 27 0 0 0 4.718 7.03l-8.059 7.74 2.248 2.189 7.917-7.709 4.924 4.795zm8.914-7.816h-3.167L19 33.917h3.167l1.773-4.625h7.52l1.79 4.625h3.167zm-4.149 10.791 2.565-6.675 2.565 6.675z"
    />
  </svg>
);
export default SvgLanguage;
