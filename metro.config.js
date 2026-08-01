// Configuração do Metro (bundler). Parte do padrão do Expo.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * A pasta `Boraumtenis/` na raiz guarda só um `.git` solto. O watcher do Metro
 * tentava ler os arquivos temporários do git ali dentro e derrubava o servidor
 * inteiro com `EACCES: lstat`. Fora da observação, o problema some.
 *
 * O padrão precisa estar ancorado nesta pasta específica. Um regex solto como
 * /[\\/]Boraumtenis[\\/].*​/ casa com qualquer trecho do caminho com esse nome —
 * e no runner do GitHub o checkout cai em `/home/runner/work/Boraumtenis/
 * Boraumtenis/`, o que bloqueava o projeto inteiro (incluindo node_modules) e
 * fazia o export falhar com "Unable to resolve module expo-router/entry".
 */
const pastaGitSolto = path.resolve(__dirname, 'Boraumtenis');
config.resolver.blockList = [
  new RegExp(`^${pastaGitSolto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\\\/]`),
];

module.exports = config;
