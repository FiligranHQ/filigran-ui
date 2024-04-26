import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgInfrastructure = ({
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
    <path
      fill="currentColor"
      d="M20.042 30.083h1.541c.41 0 .801.167 1.09.464s.452.7.452 1.12h10.792v3.166H23.125c0 .42-.162.823-.451 1.12s-.682.464-1.09.464h-6.167c-.41 0-.801-.167-1.09-.464s-.452-.7-.452-1.12H3.083v-3.166h10.792c0-.42.162-.823.451-1.12s.682-.464 1.09-.464h1.542v-3.166H6.167c-.41 0-.801-.167-1.09-.464s-.452-.7-.452-1.12V19c0-.42.162-.823.452-1.12.289-.296.68-.463 1.09-.463h24.666c.41 0 .801.166 1.09.463s.452.7.452 1.12v6.333c0 .42-.162.823-.451 1.12s-.682.464-1.09.464H20.041zM6.167 4.75h24.666c.41 0 .801.167 1.09.464s.452.7.452 1.12v6.333c0 .42-.162.822-.451 1.12-.29.296-.682.463-1.09.463H6.166c-.41 0-.801-.167-1.09-.464s-.452-.7-.452-1.12V6.334c0-.42.162-.822.452-1.12.289-.296.68-.463 1.09-.463m7.708 6.333h1.542V7.917h-1.542zm0 12.667h1.542v-3.167h-1.542zM7.708 7.917v3.166h3.084V7.917zm0 12.666v3.167h3.084v-3.167z"
    />
  </svg>
);
export default SvgInfrastructure;
