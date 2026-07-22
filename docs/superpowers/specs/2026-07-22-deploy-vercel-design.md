# Publicar o polygon na internet (Vercel)

**Data:** 2026-07-22
**Status:** aprovado

## Problema

O app só roda na máquina de desenvolvimento: `npm run dev` em localhost, ou `npm run all`
na LAN de casa com certificado auto-assinado. Ou seja, ele não serve para o uso que
justifica sua existência — abrir no celular, no território, longe do Wi-Fi de casa.

Falta uma URL HTTPS pública e estável.

## Escopo

Publicar o front estático numa URL HTTPS acessível de qualquer lugar pelo 4G.

Explicitamente **fora de escopo** (cada um exige um design próprio, e nenhum é
pré-requisito para o objetivo acima):

- Funcionamento offline (cache de dados e de tiles do mapa).
- Ícones e instalação do PWA na tela inicial.
- Domínio próprio.
- CI rodando testes/lint a cada push.

## Solução

Nada muda na arquitetura do app. O front continua estático falando direto com o
Supabase; a peça nova é apenas um CDN servindo o `dist/`.

Vercel conectada ao repositório `jplcordeiro/polygon`, com a branch `main` como
produção. Cada `git push` dispara `npm run build` — que já roda `tsc -b`, então erro
de tipo derruba o deploy, o que é desejável — e publica o `dist/`. O celular acessa
`https://<projeto>.vercel.app`.

A escolha da Vercel sobre Cloudflare Pages é de conveniência, não técnica: esforço e
custo são equivalentes, e o volume deste projeto não chega perto de nenhum limite dos
dois. GitHub Pages foi descartado por exigir um workflow do Actions para injetar as
variáveis `VITE_*` no build e um `404.html` para o roteamento — mais peças para manter,
sem ganho.

### Mudanças no repositório

1. **`vercel.json`** com um rewrite de `/(.*)` para `/index.html`.

   Sem isso, abrir `https://.../campo/3` direto na barra de endereço — ou dar F5 numa
   rota profunda — devolve 404: o roteamento é do react-router, em memória, e o CDN não
   sabe que `/campo/3` não é um arquivo. O preset Vite da Vercel provavelmente já cobre
   isso, mas quatro linhas explícitas eliminam a dúvida e documentam a intenção no
   próprio repositório.

2. **`README.md`**: um parágrafo sobre como o deploy acontece e quais variáveis vivem no
   painel da Vercel. Configuração que mora fora do repositório se perde se não estiver
   escrita dentro dele.

### Configuração manual, feita uma vez

- **Vercel → Environment Variables:** `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MAPBOX_TOKEN`.

  O `SUPABASE_ACCESS_TOKEN` **não** vai para o painel: é credencial de administrador,
  não tem função no build, e colocá-la lá é risco sem contrapartida.

- **Mapbox → allowlist de URL do token:** incluir o domínio de produção. É o passo mais
  fácil de esquecer, e o sintoma é mapa em branco — não uma mensagem de erro.

- **Supabase:** nada a fazer. O login é e-mail e senha (`signInWithPassword`), sem magic
  link, portanto não há redirect URL a cadastrar. A URL ser pública não expõe dados: a
  role `anon` não lê nada, por RLS.

## Verificação

No celular, pelo 4G — não no Wi-Fi de casa, que mascara o teste:

1. Login funciona.
2. Colar direto uma rota profunda na barra de endereço (ex.: `/campo/<id>`) carrega a
   tela, em vez de 404. Prova o rewrite.
3. O mapa desenha. Prova a allowlist do Mapbox.
4. O "você está aqui" pega a posição. Prova o HTTPS real, sem o certificado
   auto-assinado do `npm run all`.

## Risco conhecido e aceito

URLs de preview (geradas a cada push em branch) não estarão na allowlist do Mapbox, e
por isso o mapa aparecerá em branco nelas. É comportamento esperado, não defeito;
produção é o que importa.
