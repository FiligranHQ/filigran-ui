export const customizeTOCUtil = (toc: {children?: unknown[]}) => {
  try {
    const {children} = toc
    const childrenOfChildren = (
      children?.[0] as {children?: unknown[]} | undefined
    )?.children
    if (!children?.length || !childrenOfChildren?.length) return null
  } catch {
    return null
  }
  return {
    type: 'element',
    tagName: 'nav',
    properties: {
      style: {position: 'fixed', right: '2rem', width: '250px', zIndex: 10},
    },
    children: [
      {
        type: 'element',
        tagName: 'div',
        children: [
          {
            type: 'text',
            value: 'On this page',
          },
        ],
      },
      ...(toc.children || []),
    ],
  }
}
