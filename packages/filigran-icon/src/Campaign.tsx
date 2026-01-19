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
    viewBox="0 0 20 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="campaign_svg__a"
      width={24}
      height={24}
      x={-2}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-2-4h24v24H-2z" />
    </mask>
    <g mask="url(#campaign_svg__a)">
      <path
        fill="currentColor"
        d="M16 9V7h4v2zm1.2 7L14 13.6l1.2-1.6 3.2 2.4zm-2-12L14 2.4 17.2 0l1.2 1.6zM3 15v-4H2q-.824 0-1.412-.588A1.93 1.93 0 0 1 0 9V7q0-.824.588-1.412A1.93 1.93 0 0 1 2 5h4l5-3v12l-5-3H5v4zm6-4.55v-4.9L6.55 7H2v2h4.55zm3 .9v-6.7q.675.6 1.088 1.462.412.863.412 1.888t-.412 1.887A4.6 4.6 0 0 1 12 11.35"
      />
    </g>
  </svg>
);
export default SvgCampaign;
