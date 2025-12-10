import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLanguage = ({
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
      d="m13.218 15.07-2.609-2.51.031-.03A17.4 17.4 0 0 0 14.45 6h3.01V4h-7.19V2H8.216v2H1.027v2h11.472a15.7 15.7 0 0 1-3.256 5.35A15.6 15.6 0 0 1 6.871 8H4.817c.75 1.63 1.777 3.17 3.06 4.56L2.65 17.58 4.108 19l5.135-5 3.194 3.11zM19 10h-2.054l-4.622 12h2.054l1.15-3h4.879l1.16 3h2.055zm-2.69 7 1.663-4.33L19.637 17z"
    />
  </svg>
);
export default SvgLanguage;
