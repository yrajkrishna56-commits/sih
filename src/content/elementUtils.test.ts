/**
 * Tests for elementUtils.ts — visibility, clickability, ID assignment, labels.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getStableId,
  shouldSkipElement,
  isVisible,
  hasMinimumSize,
  isEnabled,
  isClickable,
  getBoundingBox,
  getElementLabel,
} from './elementUtils';

function el(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v);
  }
  return node;
}

function visibleEl(tag = 'div'): HTMLElement {
  const node = document.createElement(tag);
  document.body.appendChild(node);
  // jsdom getBoundingClientRect returns {0,0,0,0} by default;
  // override so isVisible passes the rect check
  node.getBoundingClientRect = () => ({
    x: 10, y: 10, width: 100, height: 30,
    top: 10, right: 110, bottom: 40, left: 10,
    toJSON() {},
  });
  return node;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

// ─── shouldSkipElement ──────────────────────────────────────────────
describe('shouldSkipElement', () => {
  it('skips SCRIPT', () => {
    expect(shouldSkipElement(el('script'))).toBe(true);
  });
  it('skips STYLE', () => {
    expect(shouldSkipElement(el('style'))).toBe(true);
  });
  it('skips NOSCRIPT', () => {
    expect(shouldSkipElement(el('noscript'))).toBe(true);
  });
  it('does not skip DIV', () => {
    expect(shouldSkipElement(el('div'))).toBe(false);
  });
  it('does not skip BUTTON', () => {
    expect(shouldSkipElement(el('button'))).toBe(false);
  });
});

// ─── isVisible ──────────────────────────────────────────────────────
describe('isVisible', () => {
  it('returns true for a normal element appended to body', () => {
    const node = visibleEl();
    expect(isVisible(node)).toBe(true);
  });

  it('returns false for display:none', () => {
    const node = el('div');
    node.style.display = 'none';
    document.body.appendChild(node);
    expect(isVisible(node)).toBe(false);
  });

  it('returns false for visibility:hidden', () => {
    const node = el('div');
    node.style.visibility = 'hidden';
    node.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 100, height: 100,
      top: 0, right: 100, bottom: 100, left: 0,
      toJSON() {},
    });
    document.body.appendChild(node);
    expect(isVisible(node)).toBe(false);
  });

  it('returns false when parent has display:none', () => {
    const parent = el('div');
    parent.style.display = 'none';
    const child = el('div');
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(isVisible(child)).toBe(false);
  });

  it('returns false for zero-size bounding rect', () => {
    const node = el('div');
    node.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 0, height: 0,
      top: 0, right: 0, bottom: 0, left: 0,
      toJSON() {},
    });
    document.body.appendChild(node);
    expect(isVisible(node)).toBe(false);
  });

  it('returns false for opacity:0', () => {
    const node = visibleEl();
    node.style.opacity = '0';
    expect(isVisible(node)).toBe(false);
  });
});

// ─── hasMinimumSize ─────────────────────────────────────────────────
describe('hasMinimumSize', () => {
  it('returns true for 10x10 element', () => {
    const node = el('div');
    node.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 10, height: 10,
      top: 0, right: 10, bottom: 10, left: 0,
      toJSON() {},
    });
    expect(hasMinimumSize(node)).toBe(true);
  });

  it('returns false for 1x1 element (tracking pixel)', () => {
    const node = el('div');
    node.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 1, height: 1,
      top: 0, right: 1, bottom: 1, left: 0,
      toJSON() {},
    });
    expect(hasMinimumSize(node)).toBe(false);
  });

  it('returns false for 0x0 element', () => {
    const node = el('div');
    node.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 0, height: 0,
      top: 0, right: 0, bottom: 0, left: 0,
      toJSON() {},
    });
    expect(hasMinimumSize(node)).toBe(false);
  });
});

// ─── isEnabled ──────────────────────────────────────────────────────
describe('isEnabled', () => {
  it('returns true for a normal button', () => {
    expect(isEnabled(el('button'))).toBe(true);
  });

  it('returns false for disabled attribute', () => {
    expect(isEnabled(el('button', { disabled: '' }))).toBe(false);
  });

  it('returns false for aria-disabled="true"', () => {
    expect(isEnabled(el('button', { 'aria-disabled': 'true' }))).toBe(false);
  });

  it('returns true for aria-disabled="false"', () => {
    expect(isEnabled(el('button', { 'aria-disabled': 'false' }))).toBe(true);
  });

  it('returns false for input.disabled property', () => {
    const input = document.createElement('input');
    input.disabled = true;
    expect(isEnabled(input)).toBe(false);
  });
});

// ─── isClickable ────────────────────────────────────────────────────
describe('isClickable', () => {
  it('returns true for a visible button', () => {
    const btn = visibleEl('button');
    expect(isClickable(btn)).toBe(true);
  });

  it('returns false for a disabled button', () => {
    const btn = visibleEl('button');
    btn.setAttribute('disabled', '');
    expect(isClickable(btn)).toBe(false);
  });

  it('returns true for a visible input', () => {
    const inp = visibleEl('input');
    expect(isClickable(inp)).toBe(true);
  });

  it('returns true for element with role="button"', () => {
    const div = visibleEl('div');
    div.setAttribute('role', 'button');
    expect(isClickable(div)).toBe(true);
  });

  it('returns true for element with role="link"', () => {
    const div = visibleEl('div');
    div.setAttribute('role', 'link');
    expect(isClickable(div)).toBe(true);
  });

  it('returns true for element with onclick attribute', () => {
    const div = visibleEl('div');
    div.setAttribute('onclick', 'void(0)');
    expect(isClickable(div)).toBe(true);
  });

  it('returns true for element with tabindex="0"', () => {
    const div = visibleEl('div');
    div.setAttribute('tabindex', '0');
    expect(isClickable(div)).toBe(true);
  });

  it('returns false for plain div with no interactivity', () => {
    const div = visibleEl('div');
    expect(isClickable(div)).toBe(false);
  });

  it('returns false for hidden button', () => {
    const btn = el('button');
    btn.style.display = 'none';
    document.body.appendChild(btn);
    expect(isClickable(btn)).toBe(false);
  });
});

// ─── getStableId ────────────────────────────────────────────────────
describe('getStableId', () => {
  it('generates ppba-N for element with no id or data-ppba-id', () => {
    const node = el('div');
    document.body.appendChild(node);
    const id = getStableId(node);
    expect(id).toMatch(/^ppba-\d+$/);
  });

  it('uses native id if unique in document', () => {
    const node = el('div', { id: 'unique-123' });
    document.body.appendChild(node);
    expect(getStableId(node)).toBe('unique-123');
  });

  it('falls back to ppba-N when native id is duplicated', () => {
    const a = el('div', { id: 'dup' });
    const b = el('div', { id: 'dup' });
    document.body.appendChild(a);
    document.body.appendChild(b);
    // Both have id="dup", so neither is unique → generated IDs
    expect(getStableId(a)).toMatch(/^ppba-\d+$/);
    expect(getStableId(b)).toMatch(/^ppba-\d+$/);
    expect(getStableId(a)).not.toBe(getStableId(b));
  });

  it('returns same id on re-extraction (WeakMap cache)', () => {
    const node = el('div');
    document.body.appendChild(node);
    const first = getStableId(node);
    const second = getStableId(node);
    expect(first).toBe(second);
  });

  it('reuses existing data-ppba-id attribute', () => {
    const node = el('div', { 'data-ppba-id': 'my-custom-id' });
    document.body.appendChild(node);
    expect(getStableId(node)).toBe('my-custom-id');
  });
});

// ─── getElementLabel ────────────────────────────────────────────────
describe('getElementLabel', () => {
  it('finds label by for= attribute', () => {
    const lbl = el('label');
    lbl.textContent = 'Email';
    lbl.setAttribute('for', 'email-input');
    document.body.appendChild(lbl);

    const input = el('input', { id: 'email-input' });
    document.body.appendChild(input);

    expect(getElementLabel(input)).toBe('Email');
  });

  it('finds label by wrapping <label>', () => {
    const lbl = el('label');
    lbl.textContent = 'Name';
    const input = el('input');
    lbl.appendChild(input);
    document.body.appendChild(lbl);

    expect(getElementLabel(input)).toBe('Name');
  });

  it('finds aria-label when no label element', () => {
    const input = el('input', { 'aria-label': 'Search query' });
    document.body.appendChild(input);
    expect(getElementLabel(input)).toBe('Search query');
  });

  it('returns undefined when nothing is found', () => {
    const input = el('input');
    document.body.appendChild(input);
    expect(getElementLabel(input)).toBeUndefined();
  });
});

// ─── getBoundingBox ─────────────────────────────────────────────────
describe('getBoundingBox', () => {
  it('returns rounded bounding box from getBoundingClientRect', () => {
    const node = el('div');
    node.getBoundingClientRect = () => ({
      x: 10.4, y: 20.6, width: 100.7, height: 30.3,
      top: 20.6, right: 111.1, bottom: 50.9, left: 10.4,
      toJSON() {},
    });
    expect(getBoundingBox(node)).toEqual({
      x: 10, y: 21, width: 101, height: 30,
    });
  });
});
