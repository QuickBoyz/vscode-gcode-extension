export default {
  '*.{js,ts}': ['eslint --fix', 'prettier --write', () => 'tsc --noEmit'],
  '*.{json,md}': ['prettier --write'],
};
