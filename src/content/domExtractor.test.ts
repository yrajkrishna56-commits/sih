/**
 * Tests for domExtractor.ts — full extraction pipeline.
 *
 * jsdom returns {0,0,0,0} from getBoundingClientRect by default, which
 * causes hasMinimumSize to reject elements. We monkey-patch it in beforeEach
 * so every element inserted into body gets a non-zero rect.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractPageRepresentation } from './domExtractor';

const MOCK_RECT: DOMRect = {
  x: 10, y: 10, width: 200, height: 30,
  top: 10, right: 210, bottom: 40, left: 10,
  toJSON() {},
} as DOMRect;

/** Override getBoundingClientRect on all body children so the extractor sees non-zero sizes. */
function patchBoundingRects(): void {
  Element.prototype.getBoundingClientRect = function () {
    return MOCK_RECT;
  };
}

beforeEach(() => {
  patchBoundingRects();
  document.body.innerHTML = '';
  document.title = 'Test Page';
});

afterEach(() => {
  document.body.innerHTML = '';
  // Restore default (no-op in jsdom)
});

describe('extractPageRepresentation', () => {
  it('returns correct url, title, and timestamp', () => {
    document.title = 'My Test Page';
    document.body.innerHTML = '<div>Hello</div>';
    const result = extractPageRepresentation();
    expect(result.title).toBe('My Test Page');
    expect(typeof result.url).toBe('string');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('extracts buttons', () => {
    document.body.innerHTML = `
      <button>Submit</button>
      <button>Cancel</button>
    `;
    const result = extractPageRepresentation();
    const buttons = result.elements.filter(e => e.tagName === 'BUTTON');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts inputs', () => {
    document.body.innerHTML = `
      <input type="text" placeholder="Name" />
      <input type="email" placeholder="Email" />
      <input type="password" placeholder="Password" />
    `;
    const result = extractPageRepresentation();
    const inputs = result.elements.filter(e => e.tagName === 'INPUT');
    expect(inputs.length).toBe(3);
  });

  it('extracts selects', () => {
    document.body.innerHTML = `
      <select><option>A</option><option>B</option></select>
    `;
    const result = extractPageRepresentation();
    const selects = result.elements.filter(e => e.tagName === 'SELECT');
    expect(selects.length).toBe(1);
  });

  it('extracts textareas', () => {
    document.body.innerHTML = `
      <textarea>Some text</textarea>
    `;
    const result = extractPageRepresentation();
    const textareas = result.elements.filter(e => e.tagName === 'TEXTAREA');
    expect(textareas.length).toBe(1);
  });

  it('extracts links with href', () => {
    document.body.innerHTML = `
      <a href="https://example.com">Link</a>
      <a>No href</a>
    `;
    const result = extractPageRepresentation();
    const links = result.elements.filter(e => e.tagName === 'A');
    // Only the one with href should be extracted
    expect(links.length).toBe(1);
    expect(links[0]?.text).toBe('Link');
  });

  it('extracts headings', () => {
    document.body.innerHTML = `
      <h1>Main Title</h1>
      <h2>Subtitle</h2>
      <h3>Section</h3>
    `;
    const result = extractPageRepresentation();
    const headings = result.elements.filter(e => /^H[1-6]$/.test(e.tagName));
    expect(headings.length).toBe(3);
  });

  it('extracts forms', () => {
    document.body.innerHTML = `
      <form>
        <input type="text" />
        <button>Submit</button>
      </form>
    `;
    const result = extractPageRepresentation();
    const forms = result.elements.filter(e => e.tagName === 'FORM');
    expect(forms.length).toBe(1);
  });

  it('extracts images with alt text', () => {
    document.body.innerHTML = `
      <img alt="Logo" src="logo.png" />
      <img src="no-alt.png" />
    `;
    const result = extractPageRepresentation();
    const imgs = result.elements.filter(e => e.tagName === 'IMG');
    // Only image with alt should be extracted
    expect(imgs.length).toBe(1);
    expect(imgs[0]?.text).toBe('Logo');
  });

  it('marks display:none elements as visible=false', () => {
    document.body.innerHTML = `
      <div style="display:none">
        <button>Hidden Button</button>
      </div>
    `;
    const result = extractPageRepresentation();
    const hidden = result.elements.filter(e => e.tagName === 'BUTTON' && !e.visible);
    expect(hidden.length).toBe(1);
  });

  it('marks disabled elements correctly', () => {
    document.body.innerHTML = `
      <button disabled>Disabled</button>
      <button>Enabled</button>
    `;
    const result = extractPageRepresentation();
    const disabled = result.elements.find(e => e.tagName === 'BUTTON' && e.enabled === false);
    const enabled = result.elements.find(e => e.tagName === 'BUTTON' && e.enabled === true);
    expect(disabled).toBeDefined();
    expect(enabled).toBeDefined();
  });

  it('skips script and style tags', () => {
    document.body.innerHTML = `
      <script>console.log('bad')</script>
      <style>.x{color:red}</style>
      <button>Real</button>
    `;
    const result = extractPageRepresentation();
    expect(result.elements.find(e => e.tagName === 'SCRIPT')).toBeUndefined();
    expect(result.elements.find(e => e.tagName === 'STYLE')).toBeUndefined();
    expect(result.elements.find(e => e.tagName === 'BUTTON')).toBeDefined();
  });

  it('captures aria-label', () => {
    document.body.innerHTML = `
      <button aria-label="Close dialog">X</button>
    `;
    const result = extractPageRepresentation();
    const btn = result.elements.find(e => e.tagName === 'BUTTON');
    expect(btn?.ariaLabel).toBe('Close dialog');
  });

  it('captures role attribute', () => {
    document.body.innerHTML = `
      <div role="button">Custom Button</div>
    `;
    const result = extractPageRepresentation();
    const roleBtn = result.elements.find(e => e.tagName === 'DIV' && e.role === 'button');
    expect(roleBtn).toBeDefined();
  });

  it('builds correct summary counts', () => {
    document.body.innerHTML = `
      <input type="text" />
      <input type="email" />
      <button>Go</button>
      <a href="#">Link</a>
      <form></form>
    `;
    const result = extractPageRepresentation();
    const s = result.summary;
    expect(s.inputCount).toBe(2);
    expect(s.buttonCount).toBe(1);
    expect(s.linkCount).toBe(1);
    expect(s.formCount).toBe(1);
    expect(s.totalElements).toBeGreaterThanOrEqual(5);
  });

  it('assigns stable IDs across re-extraction', () => {
    document.body.innerHTML = `
      <button id="myBtn">Click</button>
      <input type="text" />
    `;
    const first = extractPageRepresentation();
    const second = extractPageRepresentation();

    // IDs should be identical between extractions
    const firstIds = first.elements.map(e => e.id);
    const secondIds = second.elements.map(e => e.id);
    expect(firstIds).toEqual(secondIds);
  });

  it('does not produce innerHTML or raw HTML anywhere in output', () => {
    document.body.innerHTML = `
      <div class="secret">Secret stuff</div>
      <button>OK</button>
    `;
    const result = extractPageRepresentation();
    const json = JSON.stringify(result);
    expect(json).not.toContain('innerHTML');
    expect(json).not.toContain('outerHTML');
    expect(json).not.toContain('secret');
  });

  it('empty page produces empty elements array', () => {
    const result = extractPageRepresentation();
    expect(result.elements).toEqual([]);
    expect(result.summary.totalElements).toBe(0);
  });
});
