// Configuração do Metro (bundler). Parte do padrão do Expo.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * A pasta `Boraumtenis/` na raiz guarda só um `.git` solto. O watcher do Metro
 * tentava ler os arquivos temporários do git ali dentro e derrubava o servidor
 * inteiro com `EACCES: lstat`. Fora da observação, o problema some.
 */
config.resolver.blockList = [/[\\/]Boraumtenis[\\/].*/];

module.exports = config;
