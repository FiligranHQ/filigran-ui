import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgCampaign = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 38 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M30.083 34.833H7.917v-3.166h22.166zm-9.5-31.666c-1.979 0-3.831.981-4.924 2.628l-4.576 6.872 3.167 3.166 3.262-2.169c.696-.49 1.71-.3 2.2.428.032.047.08.095.08.158.475.934.3 2.058-.444 2.802l-7.6 7.6a2.25 2.25 0 0 0 .016 3.183c.412.412.982.665 1.568.665h13.585v-19a6.333 6.333 0 0 0-6.334-6.333"
    />
  </svg>
);
export default SvgCampaign;
