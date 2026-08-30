/**
 * Tests for highlighter.ts — overlay creation, cleanup, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { highlightElement, clearHighlight } from './highlighter';
import { HIGHLIGHT_CLASS, PPBA_ID_ATTR } from '../shared/constants';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

function addElement(id: string, w = 100, h = 30): HTMLDivElement {
  const div = document.createElement('div');
  div.textContent = 'test';
  div.setAttribute(PPBA_ID_ATTR, id);
  document.body.appendChild(div);

  // Override getBoundingClientRect since jsdom returns all zeros
  div.getBoundingClientRect = () => ({
    x: 10, y: 20, width: w, height: h,
    top: 20, right: 10 + w, bottom: 20 + h, left: 10,
    toJSON() {},
  });
  return div;
}

describe('highlightElement', () => {
  it('returns true and injects overlay when element exists', () => {
    addElement('ppba-1');
    const result = highlightElement('ppba-1');
    expect(result).toBe(true);

    const overlay = document.querySelector(`.${HIGHLIGHT_CLASS}`);
    expect(overlay).not.toBeNull();
    expect(overlay?.tagName).toBe('DIV');
  });

  it('returns false for non-existent element ID', () => {
    const result = highlightElement('does-not-exist');
    expect(result).toBe(false);
    expect(document.querySelector(`.${HIGHLIGHT_CLASS}`)).toBeNull();
  });

  it('injects overlay as sibling, not child of target', () => {
    const target = addElement('ppba-2');
    highlightElement('ppba-2');

    const overlay = document.querySelector(`.${HIGHLIGHT_CLASS}`);
    expect(overlay).not.toBeNull();
    // Overlay should be a sibling of the target (both children of body)
    expect(overlay?.parentElement).toBe(target.parentElement);
    expect(overlay).not.toBe(target);
    expect(target.contains(overlay!)).toBe(false);
  });

  it('sets correct z-index', () => {
    addElement('ppba-3');
    highlightElement('ppba-3');

    const overlay = document.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement;
    expect(overlay.style.zIndex).toBe('2147483647');
  });

  it('sets pointer-events: none', () => {
    addElement('ppba-4');
    highlightElement('ppba-4');

    const overlay = document.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement;
    expect(overlay.style.pointerEvents).toBe('none');
  });

  it('creates label child with element ID text', () => {
    addElement('ppba-5');
    highlightElement('ppba-5');

    const overlay = document.querySelector(`.${HIGHLIGHT_CLASS}`);
    const label = overlay?.querySelector('div');
    expect(label?.textContent).toBe('ppba-5');
  });

  it('returns false for zero-size element', () => {
    const div = document.createElement('div');
    div.setAttribute(PPBA_ID_ATTR, 'ppba-zero');
    document.body.appendChild(div);
    div.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 0, height: 0,
      top: 0, right: 0, bottom: 0, left: 0,
      toJSON() {},
    });

    const result = highlightElement('ppba-zero');
    expect(result).toBe(false);
  });
});

describe('clearHighlight', () => {
  it('removes existing overlay from DOM', () => {
    addElement('ppba-10');
    highlightElement('ppba-10');
    expect(document.querySelector(`.${HIGHLIGHT_CLASS}`)).not.toBeNull();

    clearHighlight();
    expect(document.querySelector(`.${HIGHLIGHT_CLASS}`)).toBeNull();
  });

  it('does nothing when no overlay exists', () => {
    // Should not throw
    expect(() => clearHighlight()).not.toThrow();
    expect(document.querySelector(`.${HIGHLIGHT_CLASS}`)).toBeNull();
  });

  it('calling highlight replaces previous overlay', () => {
    addElement('ppba-20');
    addElement('ppba-21');

    highlightElement('ppba-20');
    const overlays = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    expect(overlays.length).toBe(1);

    // Highlighting a new element should replace the old overlay
    highlightElement('ppba-21');
    const overlays2 = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    expect(overlays2.length).toBe(1);

    // The label should show the new ID
    const label = overlays2[0]?.querySelector('div');
    expect(label?.textContent).toBe('ppba-21');
  });
});
