import {
  buildCategoryOptions,
  toggleCategoryOption,
  selectAllCategories,
  selectNoCategories,
  getSelectedCategories,
} from '../categoryPicker.js';

describe('buildCategoryOptions', () => {
  it('lists every known scannable category, all selected by default', () => {
    const options = buildCategoryOptions();

    expect(options.map(o => o.category).sort()).toEqual(['git_worktrees', 'node_modules', 'package_caches']);
    expect(options.every(o => o.selected)).toBe(true);
  });
});

describe('toggleCategoryOption', () => {
  it('flips only the targeted option, leaving the rest untouched', () => {
    const options = buildCategoryOptions();

    const updated = toggleCategoryOption(options, 1);

    expect(updated[0].selected).toBe(true);
    expect(updated[1].selected).toBe(false);
    expect(updated[2].selected).toBe(true);
    expect(options[1].selected).toBe(true); // original untouched (immutable)
  });
});

describe('selectAllCategories / selectNoCategories', () => {
  it('selectAllCategories selects every option', () => {
    const options = selectNoCategories(buildCategoryOptions());

    const updated = selectAllCategories(options);

    expect(updated.every(o => o.selected)).toBe(true);
  });

  it('selectNoCategories deselects every option', () => {
    const options = buildCategoryOptions();

    const updated = selectNoCategories(options);

    expect(updated.every(o => !o.selected)).toBe(true);
  });
});

describe('getSelectedCategories', () => {
  it('returns only the categories currently checked', () => {
    let options = buildCategoryOptions();
    const gitWorktreesIndex = options.findIndex(o => o.category === 'git_worktrees');
    options = toggleCategoryOption(options, gitWorktreesIndex);

    const selected = getSelectedCategories(options);

    expect(selected).not.toContain('git_worktrees');
    expect(selected).toContain('node_modules');
    expect(selected).toContain('package_caches');
  });

  it('returns an empty array when nothing is selected', () => {
    const options = selectNoCategories(buildCategoryOptions());

    expect(getSelectedCategories(options)).toEqual([]);
  });
});
