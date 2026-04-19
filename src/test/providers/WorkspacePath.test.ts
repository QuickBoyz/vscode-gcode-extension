import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { WorkspacePath } from '../../providers/WorkspacePath';

describe('WorkspacePath', () => {
  describe('isUnder', () => {
    it('returns true for a direct child', () => {
      const folder = path.resolve('/repo');
      expect(WorkspacePath.isUnder(path.join(folder, 'file.nc'), folder)).toBe(true);
    });

    it('returns true for a nested descendant', () => {
      const folder = path.resolve('/repo');
      expect(WorkspacePath.isUnder(path.join(folder, 'a', 'b', 'c.nc'), folder)).toBe(true);
    });

    it('returns true when the path equals the folder', () => {
      const folder = path.resolve('/repo');
      expect(WorkspacePath.isUnder(folder, folder)).toBe(true);
    });

    it('returns false for a sibling folder with a shared prefix', () => {
      const folder = path.resolve('/repo/folder');
      expect(WorkspacePath.isUnder(path.resolve('/repo/folder-sibling/f.nc'), folder)).toBe(false);
    });

    it('returns false for unrelated paths', () => {
      expect(WorkspacePath.isUnder(path.resolve('/other/file.nc'), path.resolve('/repo'))).toBe(
        false
      );
    });
  });

  describe('hasIndexedExtension', () => {
    it('accepts known extensions', () => {
      expect(WorkspacePath.hasIndexedExtension('program.nc')).toBe(true);
      expect(WorkspacePath.hasIndexedExtension('program.gcode')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(WorkspacePath.hasIndexedExtension('PROGRAM.NC')).toBe(true);
    });

    it('rejects unknown extensions', () => {
      expect(WorkspacePath.hasIndexedExtension('notes.txt')).toBe(false);
    });

    it('rejects files without an extension', () => {
      expect(WorkspacePath.hasIndexedExtension('Makefile')).toBe(false);
    });
  });

  describe('fromFileUri', () => {
    it('converts a file URI to a filesystem path', () => {
      const original = path.resolve('/repo/file.nc');
      expect(WorkspacePath.fromFileUri(pathToFileURL(original).toString())).toBe(original);
    });

    it('returns undefined for non-file URIs', () => {
      expect(WorkspacePath.fromFileUri('http://example.com/file.nc')).toBeUndefined();
      expect(WorkspacePath.fromFileUri('untitled:new')).toBeUndefined();
    });
  });

  describe('findLongestMatchingRoot', () => {
    it('returns the containing root', () => {
      const folder = path.resolve('/repo/folder');
      const uri = pathToFileURL(path.join(folder, 'a.nc')).toString();
      expect(WorkspacePath.findLongestMatchingRoot(uri, [folder])).toBe(folder);
    });

    it('prefers the most specific (longest) matching root', () => {
      const outer = path.resolve('/repo');
      const inner = path.resolve('/repo/nested');
      const uri = pathToFileURL(path.join(inner, 'a.nc')).toString();
      expect(WorkspacePath.findLongestMatchingRoot(uri, [outer, inner])).toBe(inner);
    });

    it('returns undefined when no root matches', () => {
      const folder = path.resolve('/repo');
      const uri = pathToFileURL(path.resolve('/elsewhere/a.nc')).toString();
      expect(WorkspacePath.findLongestMatchingRoot(uri, [folder])).toBeUndefined();
    });

    it('returns undefined for non-file URIs', () => {
      const folder = path.resolve('/repo');
      expect(WorkspacePath.findLongestMatchingRoot('untitled:new', [folder])).toBeUndefined();
    });
  });
});
