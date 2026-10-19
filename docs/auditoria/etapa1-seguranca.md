# Etapa 1 — Segurança, separação entre empresas e telas que não salvavam

Data: 18/10/2026 · Feita pelo Claude Code · Base: `main` em `c568a19`
Status: **testada localmente, ainda NÃO publicada no Fly.io**.

## Resultado dos testes (`docs/auditoria/testes/`)

| | Aprovados | Falhas |
|---|---|---|
| Antes (`resultado-antes-etapa1.json`) | 36 | 50 |
| Depois (`resultado-depois-etapa1.json`) | 85 | 3 |

As 3 falhas que sobram são de estoque (saldo pelo servidor, saída maior que o saldo, movimentação
editável) — são a Etapa 2.

Testado também: banco com registros antigos sem empresa (cada um foi para a empresa de quem criou;
os sem dono, para a DNM&LTDA OBRAS `cjly25lkal4kq1a`); dois reinícios seguidos sem mudança nenhuma no
segundo; o `.zip` final extraído numa pasta limpa seguindo o README.

## O que mudou para quem usa o app

- Cada empresa vê **só os próprios dados** em todas as telas (antes, 29 tabelas eram compartilhadas).
- Funcionário **não consegue mais se promover** a administrador nem mudar de empresa.
- O **Administrador de qualquer empresa** agora aprova solicitações, lança no financeiro, edita os
  dados da própria empresa e exclui registros (antes só funcionava para quem tinha `role = admin`).
- Quem pediu uma solicitação pode corrigi-la e cancelá-la, mas não aprová-la.
- **Fornecedores, compras, EPIs e veículos**: o segundo cadastro em diante voltou a funcionar (antes só o
  primeiro do sistema inteiro era salvo). A numeração (FOR-000001, COM-000001…) é por empresa.
- **Compras e Equipamentos** voltaram a salvar pela tela; **EPIs** passam a guardar nome, CA, estoque,
  estoque mínimo e os demais campos do formulário.
- Duas empresas podem cadastrar o **mesmo fornecedor (CNPJ)** e veículos **sem chassi/RENAVAM**.
- Logs de auditoria: só o administrador da empresa lê; ninguém altera nem apaga; visitante sem login
  não grava.
- Token do convite nunca aparece para outros usuários.

Nenhuma tela foi alterada. Nenhum dado é apagado.

## Arquivos

| Arquivo | O quê |
|---|---|
| `pb_hooks/seguranca-etapa1.pb.js` (novo) | Regras por empresa, permissões por cargo, `company_id` nas 29 tabelas + preenchimento dos registros antigos, índices únicos por empresa, proteção do token. |
| `pb_hooks/fix-schema-telas.pb.js` (novo) | Campos que as telas de Compras, Equipamentos e EPIs usam; campos antigos em inglês ficam opcionais e espelhados. |
| `pb_hooks/generate-{fornecedor,compra,epi,solicitacao,veiculo}-id.pb.js` | Numeração corrigida e por empresa. |
| `pb_hooks/log-security-event.pb.js` | Desativados `fix-users-createrule` e `fix-users-update-delete-view-rules` (regravavam as regras de usuários a cada boot e desfaziam a correção). |
| `appobra_deploy_final.zip` | Mesmo conteúdo do `main`, com os hooks acima. |
| `pb_hooks/`, `pb_migrations/` soltos | Sincronizados com o `.zip` (estavam desatualizados; o Fly usa só o `.zip`). |

Lições técnicas registradas nos comentários dos hooks:
- Campo `hidden` no PocketBase **não é gravável pela API** — por isso o token do convite é escondido por
  `onRecordEnrich` + bloqueio de filtro, não por `hidden`.
- `onBootstrap` de arquivos diferentes não têm ordem garantida; hooks que regravam a mesma regra
  brigam entre si. Antes de criar hook que mexe em regras de `users`, ver `seguranca-etapa1.pb.js`.
- No JSVM, `field.type` é método (`field.type()`), e cada handler roda isolado (constantes ficam dentro).
- Regras com `@request.auth.company_id = company_id` precisam de `@request.auth.id != ""`, senão um
  visitante passa em registro sem empresa (`"" = ""`).

## Como publicar (Cowork/Diego — painel do Fly.io)

1. **Backup antes:** Fly.io → app `appobra-backend` → Volumes → `appobra_data` → criar snapshot
   (ou confirmar que existe o snapshot diário de hoje).
2. Levar esta branch para o `main` (merge da `ccr-6751e2d4-oj4p0r`, ou subir o `appobra_deploy_final.zip`
   desta branch no lugar do atual).
3. Redeploy do `appobra-backend`.
4. Nos logs do Fly, conferir que aparecem `[seguranca-etapa1] Regras de segurança e separação por
   empresa aplicadas.` e `[fix-schema-telas] ...` e **nenhuma** linha `[seguranca-etapa1] Erro` ou
   `failed to execute`.
5. Teste rápido em produção (Diego):
   - entrar com `dnmltda@hotmail.com` e ver os dados normalmente;
   - cadastrar 2 fornecedores, 1 compra, 1 equipamento, 1 EPI (com estoque) — todos devem salvar;
   - aprovar uma solicitação;
   - entrar com um funcionário comum e editar o próprio telefone.
6. Aproveitar o redeploy para colocar nos Secrets do Fly `BREVO_SMTP_LOGIN` e `BREVO_SMTP_KEY` (e-mails
   de convite).

**Para desfazer:** redeploy do `.zip` anterior. Os campos criados e os índices por empresa continuam no
banco (são inofensivos); as regras antigas voltam com os hooks antigos.
