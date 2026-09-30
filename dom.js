/* SPECTRA · dom.js
   In-place page updates. patchHTML(host, html) makes host's contents match html
   while keeping the existing elements that are still there. Because elements are
   kept rather than rebuilt, the page no longer jumps, the text box being typed in
   keeps its focus and cursor, and sections the student opened stay open.

   Rules that keep behaviour identical to a full redraw:
   - Attributes, text, checkbox states and select choices always follow the new HTML.
   - Values of text boxes follow the new HTML. The box with focus is only touched if its value
     really changed (for example after Undo), and then its cursor position is kept.
   - Event handlers are cleared on every kept element, then the bind functions set
     them again, exactly as they did on freshly built elements.
   - <details> keep the open/closed state the student chose.
*/
const PATCH_HANDLERS = ['onclick', 'onchange', 'oninput', 'onsubmit', 'onkeydown', 'onkeyup', 'onfocus', 'onblur',
  'onpointerdown', 'onpointermove', 'onpointerup', 'onpointercancel', 'ondragover', 'ondragenter', 'ondragleave', 'ondrop',
  'onmousedown', 'onmouseup', 'onpaste'];

function patchHTML(host, html) {
  if (!host) return;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  patchChildren(host, tpl.content);
}

function patchSameKind(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  if (a.tagName !== b.tagName || a.namespaceURI !== b.namespaceURI) return false;
  if ((a.id || b.id) && a.id !== b.id) return false;
  if (a.tagName === 'INPUT' && a.type !== (b.getAttribute('type') || 'text').toLowerCase()) return false;
  return true;
}

function patchChildren(from, to) {
  const byId = new Map();
  for (const el of from.children) if (el.id) byId.set(el.id, el);
  let cursor = from.firstChild;
  for (const next of [...to.childNodes]) {
    let match = null;
    if (next.nodeType === 1 && next.id) {
      const found = byId.get(next.id);
      if (found && found.parentNode === from && patchSameKind(found, next)) match = found;
    } else if (cursor && patchSameKind(cursor, next)) match = cursor;
    if (match) {
      if (match === cursor) cursor = cursor.nextSibling; else from.insertBefore(match, cursor);
      patchNode(match, next);
    } else from.insertBefore(next, cursor);
  }
  while (cursor) { const after = cursor.nextSibling; from.removeChild(cursor); cursor = after; }
}

function patchNode(from, to) {
  if (from.nodeType !== 1) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  PATCH_HANDLERS.forEach(h => { if (from[h]) from[h] = null; });
  const keepOpen = from.tagName === 'DETAILS';
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name) && !(keepOpen && name === 'open')) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value && !(keepOpen && name === 'open')) from.setAttribute(name, value);
  const tag = from.tagName, focused = from === document.activeElement;
  if (tag === 'TEXTAREA') {
    if (from.defaultValue !== to.defaultValue) from.defaultValue = to.defaultValue;
    patchValue(from, to.defaultValue, focused);
    return;
  }
  if (tag === 'INPUT') {
    const type = from.type;
    if (type === 'checkbox' || type === 'radio') from.checked = to.hasAttribute('checked');
    else if (type !== 'file') patchValue(from, to.getAttribute('value') ?? '', focused);
    return;
  }
  patchChildren(from, to);
  if (tag === 'SELECT') {
    const options = [...from.options], chosen = options.findIndex(o => o.hasAttribute('selected'));
    if (from.multiple) options.forEach(o => o.selected = o.hasAttribute('selected'));
    else if (options.length) from.selectedIndex = chosen >= 0 ? chosen : Math.max(0, options.findIndex(o => !o.disabled));
  } else if (tag === 'OPTION') from.selected = to.hasAttribute('selected');
}

/* Set a field's value only when it differs. A field being typed in already holds the saved
   value, so it is left alone; if the value did change (undo, opening a file), the cursor is kept. */
function patchValue(el, value, focused) {
  if (el.value === value) return;
  let start = null, end = null;
  if (focused) try { start = el.selectionStart; end = el.selectionEnd; } catch (e) { /* number fields have no cursor API */ }
  el.value = value;
  if (focused && start !== null) try { el.setSelectionRange(Math.min(start, value.length), Math.min(end, value.length)); } catch (e) { /* ignore */ }
}

/* Drop zones: property handlers, so binding twice never doubles them. */
function bindDropZone(el, onDrop) {
  if (!el) return;
  el.ondragover = el.ondragenter = e => { e.preventDefault(); el.classList.add('over'); };
  el.ondragleave = e => { e.preventDefault(); el.classList.remove('over'); };
  el.ondrop = e => { e.preventDefault(); el.classList.remove('over'); onDrop(e); };
}
