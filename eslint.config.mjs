import treesitter from 'eslint-config-treesitter'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

export default defineConfig([
  globalIgnores(['src/*', 'bindings/*']),
  ...treesitter,
  eslintPluginPrettierRecommended,
])
