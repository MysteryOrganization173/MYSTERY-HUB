import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activityDigest} from '../../../src/utils/customerActivity';

test('Overview activity digest collapses back-to-back repeats and keeps the latest time', () => {
  const rows = activityDigest([
    {label:'page view',at:'2026-10-16T10:05:00Z'},
    {label:'page view',at:'2026-10-16T10:04:00Z'},
    {label:'page view',at:'2026-10-16T10:03:00Z'},
    {label:'whatsapp click',at:'2026-10-16T10:02:00Z'},
    {label:'page view',at:'2026-10-16T10:01:00Z'},
  ]);
  assert.deepEqual(rows, [
    {label:'page view',at:'2026-10-16T10:05:00Z',count:3},
    {label:'whatsapp click',at:'2026-10-16T10:02:00Z',count:1},
    {label:'page view',at:'2026-10-16T10:01:00Z',count:1},
  ]);
  assert.deepEqual(activityDigest([]), []);
});

test('Overview shows at most five digest rows; Analytics keeps the full recent list', () => {
  const source = readFileSync('src/components/website/WebsiteBusinessDashboard.tsx', 'utf8');
  assert.match(source, /tab==='Overview'\?activityDigest\(recent\)\.slice\(0,5\)/);
  assert.match(source, /See all activity/);
});

test('Published designed sites omit an empty location ribbon; the editor keeps it as a tap target', () => {
  for (const name of ['Hotel', 'Restaurant', 'Salon']) {
    const source = readFileSync(`src/components/website/templates/${name}TemplateView.tsx`, 'utf8');
    assert.match(source, /\{\(template\.location \|\| editing\) && \(/, name);
    assert.match(source, /const editing = useIsVisualEditing\(\);/, name);
  }
  assert.match(readFileSync('src/components/website/editor/VisualEditMarkers.tsx', 'utf8').replace(/\r\n/g, '\n'), /export function useIsVisualEditing\(\) \{\n  return useContext\(VisualEditContext\)\.length > 0;/);
});

test('Designed-site menus hide in-page links whose section is not on the page', () => {
  const source = readFileSync('src/components/website/WebsiteContrastBoundary.tsx', 'utf8');
  assert.match(source, /querySelectorAll<HTMLAnchorElement>\('a\[href\^="#"\]'\)/);
  assert.match(source, /link\.hidden=missing/);
  assert.match(source, /new MutationObserver\(sync\)/);
});
