import { Extension } from '@tiptap/core';

const BULLET_STYLES = ['disc', 'circle', 'square'];

const styleAttribute = (property: string, value: unknown): Record<string, string> =>
  (typeof value === 'string' && value !== '' ? { style: `${property}: ${value}` } : {});

/**
 * Keeps the left margin of lists and the bullet style of bullet lists. Stored content has both
 * (<ul style="margin-left:32px; list-style-type:square">), and Word lists pasted with their indentation use them.
 */
export const ListStyle = Extension.create({
  name: 'listStyle',

  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          marginLeft: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.marginLeft || null,
            renderHTML: (attributes: Record<string, unknown>) => styleAttribute('margin-left', attributes.marginLeft),
          },
        },
      },
      {
        types: ['bulletList'],
        attributes: {
          listStyleType: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const style = element.style.listStyleType || element.getAttribute('type')?.toLowerCase() || '';
              return BULLET_STYLES.includes(style) ? style : null;
            },
            renderHTML: (attributes: Record<string, unknown>) => styleAttribute('list-style-type', attributes.listStyleType),
          },
        },
      },
    ];
  },
});
