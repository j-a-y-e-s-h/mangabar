import * as assert from 'assert';
import { getReaderEnhancerScript } from '../src/readerEnhancer';

describe('ReaderPanel & Enhancer Suite', () => {
  it('enhancer script generates valid non-empty javascript', () => {
    const code = getReaderEnhancerScript();
    assert.ok(code.length > 500, 'Enhancer script should be substantial');
    assert.ok(code.includes('__MANGABAR_ENHANCER_LOADED__'), 'Must contain guard');
    assert.ok(code.includes('case \'reload\''), 'Must support reload command');
    assert.ok(code.includes('case \'zoomIn\''), 'Must support zoomIn command');
    assert.ok(code.includes('case \'scrollDown\''), 'Must support scrollDown command');
  });

  it('verifies brand scrub tokens', () => {
    const code = getReaderEnhancerScript();
    assert.ok(code.includes('Suwayomi'), 'Contains scrubber patterns');
    assert.ok(code.includes('MangaBar'), 'Scrubs to MangaBar');
  });
});
