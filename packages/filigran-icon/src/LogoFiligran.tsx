import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLogoFiligran = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 29 29"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.5 29C22.508 29 29 22.508 29 14.5S22.508 0 14.5 0 0 6.492 0 14.5 6.492 29 14.5 29m0-1.776c7.028 0 12.724-5.696 12.724-12.724S21.529 1.776 14.5 1.776 1.776 7.472 1.776 14.5 7.472 27.224 14.5 27.224"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M4.485 4.186h1.794v20.629H4.485zM8.969 1.794h1.794v25.412H8.969zM13.454.598h1.794v26.907h-1.794zM18.237 18.237h1.794v9.268h-1.794z"
    />
    <path
      fill="currentColor"
      d="M18.237 18.237h9.268v1.794h-9.268zM18.237 21.526h3.588v1.794h-3.588zM13.454 13.753h14.649v1.794H13.454zM13.454 9.268h13.454v1.794H13.454zM13.454 4.485h11.06v1.794h-11.06z"
    />
  </svg>
);
export default SvgLogoFiligran;
