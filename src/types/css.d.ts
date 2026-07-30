// Permite importar arquivos CSS / CSS Modules em TypeScript (usados pela web via Metro/Nativewind).
declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
