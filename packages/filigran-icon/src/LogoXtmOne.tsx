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
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="m17.09 10.896 5.365-5.628-1.187-1.247-7.395 7.756 4.32 4.53 1.188-1.246-2.291-2.403h6.86v-1.762zM16.28 6.036 15.09 4.791l-2.29 2.402V0h-1.68v7.193L5.286 1.075 4.1 2.321l7.861 8.246zM5.757 7.693 4.568 8.94l2.291 2.402H0v1.762h6.86l-5.756 6.037 1.188 1.245 7.784-8.163zM7.67 17.963l1.188 1.246 2.29-2.403V24h1.681v-7.194l5.898 6.187 1.189-1.246-7.927-8.313z"
    />
  </svg>
);
export default SvgLogoXtmOne;
