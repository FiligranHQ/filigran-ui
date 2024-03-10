export const customizeTOCUtil = (toc: any) => {
  try {
    const {children} = toc
    const childrenOfChildren = children?.[0]?.children
    if (!children?.length || !childrenOfChildren?.length) return null
  } catch (e) {}
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
