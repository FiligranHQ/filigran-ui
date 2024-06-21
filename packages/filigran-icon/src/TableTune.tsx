import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgTableTune = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.177 7.008v1.657h1.657V7.008zm3.314 0v3.314H6.52V8.665H4.492V7.008H6.52V5.35h4.971zm8.017 0h-6.966v1.657h6.966zm0 9.984H17.48v1.657H12.51v-4.971h4.971v1.657h2.028zm-3.685-1.657h-1.657v1.657h1.657zm-11.33 1.657h6.965v-1.657H4.492z"
      clipRule="evenodd"
    />
  </svg>
);
export default SvgTableTune;
