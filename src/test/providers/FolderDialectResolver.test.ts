import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DialectType } from '../../constants';
import { FolderDialectResolver } from '../../providers/FolderDialectResolver';

function uriOf(p: string): string {
  return pathToFileURL(p).toString();
}

describe('FolderDialectResolver', () => {
  describe('resolveForFileUri', () => {
    it('returns the dialect of the folder that contains the file', () => {
      const folderA = path.resolve('/repo/folder-a');
      const folderB = path.resolve('/repo/folder-b');
      const dialects = new Map<string, DialectType>([
        [folderA, DialectType.FANUC],
        [folderB, DialectType.LINUXCNC],
      ]);
      const resolver = new FolderDialectResolver(dialects, [folderA, folderB]);

      expect(resolver.resolveForFileUri(uriOf(path.join(folderA, 'sub', 'a.nc')))).toBe(
        DialectType.FANUC
      );
      expect(resolver.resolveForFileUri(uriOf(path.join(folderB, 'b.nc')))).toBe(
        DialectType.LINUXCNC
      );
    });

    it('resolves overlapping roots to the longest prefix', () => {
      const outer = path.resolve('/repo');
      const inner = path.resolve('/repo/nested');
      const dialects = new Map<string, DialectType>([
        [outer, DialectType.HAAS],
        [inner, DialectType.SIEMENS],
      ]);
      const resolver = new FolderDialectResolver(dialects, [outer, inner]);

      expect(resolver.resolveForFileUri(uriOf(path.join(inner, 'file.nc')))).toBe(
        DialectType.SIEMENS
      );
      expect(resolver.resolveForFileUri(uriOf(path.join(outer, 'top.nc')))).toBe(DialectType.HAAS);
    });

    it('falls back to the first mapped dialect when no root matches', () => {
      const folder = path.resolve('/repo/known');
      const dialects = new Map<string, DialectType>([[folder, DialectType.FANUC]]);
      const resolver = new FolderDialectResolver(dialects, [folder]);

      expect(resolver.resolveForFileUri(uriOf(path.resolve('/somewhere/else/x.nc')))).toBe(
        DialectType.FANUC
      );
    });

    it('falls back to LINUXCNC when the dialect map is empty', () => {
      const resolver = new FolderDialectResolver(new Map(), []);
      expect(resolver.resolveForFileUri(uriOf(path.resolve('/any/file.nc')))).toBe(
        DialectType.LINUXCNC
      );
    });

    it('falls back to the first mapped dialect for non-file URIs', () => {
      const folder = path.resolve('/repo');
      const dialects = new Map<string, DialectType>([[folder, DialectType.HAAS]]);
      const resolver = new FolderDialectResolver(dialects, [folder]);

      expect(resolver.resolveForFileUri('untitled:foo')).toBe(DialectType.HAAS);
    });
  });

  describe('resolveFolderUriForFileUri (static)', () => {
    it('returns the folder URI when a root contains the file', () => {
      const folder = path.resolve('/repo/folder-a');
      const fileUri = uriOf(path.join(folder, 'sub', 'file.nc'));

      expect(FolderDialectResolver.resolveFolderUriForFileUri(fileUri, [folder])).toBe(
        uriOf(folder)
      );
    });

    it('returns an empty string when no root contains the file', () => {
      const folder = path.resolve('/repo/folder-a');
      const fileUri = uriOf(path.resolve('/outside/file.nc'));

      expect(FolderDialectResolver.resolveFolderUriForFileUri(fileUri, [folder])).toBe('');
    });

    it('returns an empty string for non-file URIs', () => {
      const folder = path.resolve('/repo');
      expect(FolderDialectResolver.resolveFolderUriForFileUri('untitled:new', [folder])).toBe('');
    });

    it('prefers the most specific matching root', () => {
      const outer = path.resolve('/repo');
      const inner = path.resolve('/repo/nested');
      const fileUri = uriOf(path.join(inner, 'file.nc'));

      expect(FolderDialectResolver.resolveFolderUriForFileUri(fileUri, [outer, inner])).toBe(
        uriOf(inner)
      );
    });
  });
});
