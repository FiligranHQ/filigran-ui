// Whether the HTML flavor of a clipboard holds text. Style and script blocks are not text: a clipboard whose HTML only
// wraps a picture can carry one.
export const hasTextContent = (html: string): boolean => {
  if (html === '') return false;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style, script').forEach((element) => element.remove());
  return (doc.body.textContent ?? '').trim() !== '';
};

// The picture to paste in place of the clipboard HTML: only when that HTML is missing or holds no text (a screenshot,
// a copied picture). Otherwise the HTML is pasted, even when the clipboard also holds a picture of the selection,
// as Word, Excel and PowerPoint provide.
export const clipboardImageFile = (data: Pick<DataTransfer, 'getData' | 'items'>): File | null => {
  if (hasTextContent(data.getData('text/html'))) return null;
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
};
