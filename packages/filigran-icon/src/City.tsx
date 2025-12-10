import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCity = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 25 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M15.405 23h-2.054v-2h2.054zm4.109-2h-2.055v2h2.055zm-4.109-4h-2.054v2h2.054zM7.19 21H5.135v2H7.19zm0-4H5.135v2H7.19zm12.325 0h-2.055v2h2.055zm-4.109-4h-2.054v2h2.054zm4.109 0h-2.055v2h2.055zm2.054-4c.544 0 1.067.21 1.452.586.385.375.602.884.602 1.414v12h-2.054V11h-10.27v12H9.242v-8H3.081v8H1.027v-8c0-.53.216-1.04.602-1.414A2.08 2.08 0 0 1 3.08 13h6.162v-2c0-.53.217-1.04.602-1.414A2.08 2.08 0 0 1 11.297 9V7c0-.53.217-1.04.602-1.414A2.08 2.08 0 0 1 13.35 5h2.054V1h2.054v4h2.055c.544 0 1.067.21 1.452.586.385.375.602.884.602 1.414zm-2.055 0V7h-6.162v2z"
    />
  </svg>
);
export default SvgCity;
