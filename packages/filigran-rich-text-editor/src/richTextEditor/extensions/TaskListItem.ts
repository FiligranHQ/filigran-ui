import { TaskItem as TaskItemBase } from '@tiptap/extension-task-item';

const LEGACY_CHECKBOX = ':scope > label > input[type="checkbox"]';

export const TaskItem = TaskItemBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      checked: {
        default: false,
        keepOnSplit: false,
        // The legacy editor has no data-checked: its state is on the checkbox.
        parseHTML: (element: HTMLElement) => {
          const dataChecked = element.getAttribute('data-checked');
          if (dataChecked !== null) return dataChecked === '' || dataChecked === 'true';
          return element.querySelector(LEGACY_CHECKBOX)?.hasAttribute('checked') ?? false;
        },
        renderHTML: (attributes) => ({ 'data-checked': attributes.checked }),
      },
    };
  },

  parseHTML() {
    return [
      // Default Tiptap. Its content sits in a <div> next to the checkbox <label>: parse only that
      // <div>, otherwise the Div node takes it and the task text moves out of the list.
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
        contentElement: (element: HTMLElement) => element.querySelector(':scope > div') ?? element,
      },
      // Legacy editor
      {
        tag: 'ul.todo-list > li',
        priority: 52,
      },
    ];
  },
});
