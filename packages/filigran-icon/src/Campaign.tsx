import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCampaign = ({
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
      d="M19 22H5v-2h14zM13 2c-1.25 0-2.42.62-3.11 1.66L7 8l2 2 2.06-1.37c.44-.31 1.08-.19 1.39.27.02.03.05.06.05.1.3.59.19 1.3-.28 1.77l-4.8 4.8c-.55.56-.55 1.46.01 2.01.26.26.62.42.99.42H17V6a4 4 0 0 0-4-4"
    />
  </svg>
);
export default SvgCampaign;
