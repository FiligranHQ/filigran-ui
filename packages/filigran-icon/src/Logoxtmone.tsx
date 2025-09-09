import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLogoXtmOne = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 172 164"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="m122.326 74.361 38.404-38.41-8.499-8.507-52.93 52.93 30.918 30.918 8.506-8.506-16.399-16.399h49.097V74.361zM116.525 41.197l-8.506-8.5L91.627 49.09V0H79.595v49.09L37.844 7.34l-8.506 8.499 56.27 56.276zM41.204 52.504l-8.506 8.507 16.399 16.398H0v12.026h49.097L7.899 130.633l8.507 8.499 55.716-55.71zM54.897 122.592l8.506 8.507L79.795 114.7v49.096h12.032V114.7l42.218 42.224 8.506-8.507-56.737-56.736z"
    />
  </svg>
);
export default SvgLogoXtmOne;
