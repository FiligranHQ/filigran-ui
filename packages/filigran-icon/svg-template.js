const svgTemplate = (
  { imports, interfaces, componentName, props, jsx, exports },
  { tpl },
) => {
  return tpl`
${imports}
import type {SVGRProps} from '../model/svgr'

const ${componentName} = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  ${jsx}
);


${exports}
  `
};

export default svgTemplate;
