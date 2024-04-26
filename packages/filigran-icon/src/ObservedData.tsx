import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgObservedData = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#observed-data_svg__a)">
      <path
        fill="currentColor"
        d="M18.5 17.417c-1.696 0-3.083 1.425-3.083 3.166 0 1.742 1.387 3.167 3.083 3.167s3.083-1.425 3.083-3.167-1.387-3.166-3.083-3.166m9.25 3.166c0-5.24-4.147-9.5-9.25-9.5s-9.25 4.26-9.25 9.5a9.54 9.54 0 0 0 4.625 8.218l1.542-2.755a6.36 6.36 0 0 1-3.084-5.463c0-3.499 2.76-6.333 6.167-6.333s6.167 2.834 6.167 6.333a6.36 6.36 0 0 1-3.084 5.463l1.542 2.755a9.54 9.54 0 0 0 4.625-8.218M18.5 4.75c-8.51 0-15.417 7.093-15.417 15.833 0 5.859 3.1 10.957 7.693 13.696l1.542-2.739c-3.67-2.2-6.151-6.27-6.151-10.957 0-6.998 5.519-12.666 12.333-12.666s12.333 5.668 12.333 12.666c0 4.687-2.482 8.756-6.166 10.957l1.541 2.74c4.61-2.74 7.709-7.838 7.709-13.697 0-8.74-6.907-15.833-15.417-15.833"
      />
    </g>
    <defs>
      <clipPath id="observed-data_svg__a">
        <path fill="#fff" d="M0 0h37v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgObservedData;
