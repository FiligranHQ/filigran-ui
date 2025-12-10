import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowsInput = ({
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
    <path d="m156-100-56-56 124-124H120v-80h240v240h-80v-104zm648 0L680-224v104h-80v-240h240v80H736l124 124zM120-600v-80h104L100-804l56-56 124 124v-104h80v240zm480 0v-240h80v104l124-124 56 56-124 124h104v80zM480-400q-33 0-56.5-23.5T400-480t23.5-56.5T480-560t56.5 23.5T560-480t-23.5 56.5T480-400" />
  </svg>
);
export default SvgArrowsInput;
