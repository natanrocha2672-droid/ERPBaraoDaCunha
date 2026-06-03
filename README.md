# ERPNext Nota Facil

Aplicacao web para criar Sales Invoice no ERPNext pela Vercel.

## Recursos

- Configuracao dos dados da empresa na tela.
- Salvamento local das informacoes no navegador.
- Teste de conexao com ERPNext.
- Criacao de cliente se necessario.
- Criacao de Sales Invoice.
- Opcao de rascunho ou submissao automatica.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Vercel

Configure as variaveis de ambiente do ERPNext diretamente no painel da Vercel.

## Observacao fiscal

Este projeto cria uma Sales Invoice no ERPNext. Para emitir NF-e ou NFS-e brasileira de verdade, o ERPNext precisa estar com configuracao fiscal, impostos, series, certificado e/ou integracao fiscal configurados.