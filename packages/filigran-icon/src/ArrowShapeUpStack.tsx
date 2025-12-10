import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowShapeUpStack = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 -960 960 960"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path d="M360-160v-120H160l320-360 320 360H600v120zm80-80h80v-120h102L480-520 338-360h102zM160-480l320-360 320 360H693L480-720 267-480zm320 120" />
  </svg>
);
export default SvgArrowShapeUpStack;
