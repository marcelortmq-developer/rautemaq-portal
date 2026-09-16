# Rautemaq — Portal técnico

Website para consulta de soluções, anotações privadas, versões e arquivos de instalação.

## Executar

Requer Node.js 22 ou superior.

1. Prepare um projeto Supabase e execute `supabase/schema.sql` uma vez em um banco novo.
2. Copie `.env.example` para `.env` e configure as credenciais somente no servidor.
3. Execute `npm run dev` e abra http://localhost:3000.

As contas devem ser provisionadas pelo responsável pela implantação. Nenhuma senha ou credencial de produção está incluída neste repositório.

## Publicar

Importe este repositório na Vercel, use Framework Preset **Other**, comando `npm run build` e saída `dist`. Configure as variáveis de ambiente no painel da Vercel. O endpoint `api/portal.js` precisa do runtime Node.js.

## Verificar

```bash
npm test
npm run build
```

A prévia visual disponível na tela inicial contém apenas exemplos. Para utilizar os dados reais, é necessário configurar o backend.
