import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgDesignServices = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 20 20"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="design_services_svg__a"
      width={24}
      height={24}
      x={-2}
      y={-2}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-2-2h24v24H-2z" />
    </mask>
    <g mask="url(#design_services_svg__a)">
      <path
        fill="currentColor"
        d="m6.8 8.95 2.15-2.175-1.4-1.425-1.1 1.1-1.4-1.4 1.075-1.1L5 2.825 2.825 5zm8.2 8.225L17.175 15l-1.125-1.125-1.1 1.075-1.4-1.4 1.075-1.1-1.425-1.4-2.15 2.15zM5.25 19H1v-4.25l4.375-4.375L0 5l5-5 5.4 5.4 3.775-3.8q.3-.3.675-.45a2.07 2.07 0 0 1 1.55 0q.375.15.675.45L18.4 2.95q.3.3.45.675T19 4.4a1.98 1.98 0 0 1-.6 1.425l-3.775 3.8L20 15l-5 5-5.375-5.375zM3 17h1.4l9.8-9.775L12.775 5.8 3 15.6z"
      />
    </g>
  </svg>
);
export default SvgDesignServices;
