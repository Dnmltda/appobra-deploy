# Publicar as Etapas 1 a 4 do APP OBRA — roteiro para a Cowork

Preparado pelo Claude Code em 18/10/2026. Tudo foi testado num servidor de teste isolado:
servidor **199/0**, telas **118/118**, rodando a partir do mesmo `appobra_deploy_final.zip` que vai para o ar.

**Onde está:** GitHub `Dnmltda/appobra-deploy`, branch **`ccr-6751e2d4-oj4p0r`**
(https://github.com/Dnmltda/appobra-deploy/tree/ccr-6751e2d4-oj4p0r). O `main` ainda não tem nada disso.
A branch contém o `main` atual inteiro: o merge não tem conflito.

---

## Prompt para colar na Cowork

```
Cowork, preciso que você publique a atualização do APP OBRA que o Claude Code preparou e testou.
Leia primeiro o roteiro completo no GitHub: repositório Dnmltda/appobra-deploy, branch
ccr-6751e2d4-oj4p0r, arquivo docs/PUBLICAR-COWORK.md (e o resumo do projeto em
docs/appobra_handoff_claude_code.md). Siga os passos na ordem, um por vez.

Regras:
- Passos sensíveis (colar chaves/secrets, apertar Merge, confirmar deploy) quem faz sou eu, Diego:
  deixe a tela pronta e me diga exatamente onde clicar e o que colar. Nunca escreva a chave do Brevo
  em lugar nenhum além do campo de Secrets do Fly.
- Antes de qualquer coisa, faça o snapshot do volume appobra_data no Fly.io (passo 1). Sem snapshot,
  não continue.
- Antes do passo da limpeza (LIMPEZA_INICIAL), me pergunte de novo se eu confirmo: ela apaga todos os
  outros usuários e funcionários e deixa só o dnmltda@hotmail.com.
- Depois do deploy, confira os logs (passo 6) e me mostre as linhas encontradas. Se aparecer
  "failed to execute" ou alguma linha com "Erro" que não esteja na lista de avisos esperados, pare e
  me avise antes de seguir.
- No fim, faça comigo o teste rápido (passo 9) e me diga o que passou e o que não passou.
- Ao terminar, atualize docs/appobra_handoff_claude_code.md com o que foi publicado e o que ficou
  pendente (protocolo de transição Cowork ↔ Code).
```

---

## Roteiro (passo a passo)

### 1. Cópia de segurança (obrigatório)
Fly.io → app **`appobra-backend`** → **Volumes** → `appobra_data` → **Create snapshot**. Anotar o horário.
É ela que desfaz tudo se algo der errado (inclusive a limpeza do passo 3).

### 2. Brevo (e-mails)
- Brevo → **SMTP & API** → **SMTP**: a chave antiga ficou exposta no histórico do GitHub (repositório
  público). **Revogar/apagar a chave antiga** e usar a chave nova que o Diego já criou.
- Anotar o **login SMTP** (formato `xxxxx@smtp-brevo.com`), que vai no passo 3.

### 3. Secrets no Fly (quem cola é o Diego)
Fly.io → `appobra-backend` → **Secrets**:

| Nome | Valor | Observação |
|---|---|---|
| `BREVO_SMTP_LOGIN` | login SMTP do Brevo | obrigatório para os e-mails |
| `BREVO_SMTP_KEY` | a chave SMTP nova | **Diego cola**; nunca em arquivo |
| `LIMPEZA_INICIAL` | `sim` | **confirmar com o Diego antes** (ver abaixo); roda uma vez só |
| `FRONT_URL` | endereço do app, sem `/` no final | **opcional**, ver passo 8 |
| `SMTP_SENDER_EMAIL` | remetente | opcional; padrão `dnmltda@hotmail.com` |
| `CONTATO_EMAIL` | quem recebe o "Fale conosco" | opcional; padrão `dnmltda@hotmail.com` |

**O que `LIMPEZA_INICIAL=sim` faz** (pedido do Diego: "deixar apenas o dnmltda@hotmail.com"):
- age só na empresa do `dnmltda@hotmail.com`, uma vez, tudo ou nada;
- deixa **só o `dnmltda@hotmail.com`** (ele passa a ter o ID **01**);
- apaga os outros acessos e funcionários; quem tem histórico (retirada, movimentação, compra…) é
  **arquivado** em vez de apagado, e o histórico continua mostrando o nome;
- arquiva os materiais de exemplo que nunca tiveram movimentação e estão com saldo zero.

Salvar os Secrets pode reiniciar o app com o código antigo; isso não faz mal (o código antigo ignora
essas variáveis).

### 4. Levar a atualização para o `main` (quem aperta é o Diego)
Abrir https://github.com/Dnmltda/appobra-deploy/compare/main...ccr-6751e2d4-oj4p0r →
**Create pull request** → **Merge pull request** → **Confirm merge**.

### 5. Deploy
- Se o `appobra-backend` publica sozinho a partir do GitHub, o merge do passo 4 já dispara o deploy:
  acompanhar em Fly.io → `appobra-backend` → **Activity/Releases**.
- Se o deploy é manual: no computador do Diego, atualizar a pasta do repositório (`git pull` no `main`) e
  rodar `fly deploy` nela (o `Dockerfile` usa o `appobra_deploy_final.zip`).

### 6. Conferir os logs (Fly.io → `appobra-backend` → **Logs**, logo após o boot)
Linhas que **devem** aparecer (algumas só na primeira vez):
- `[entrypoint] Existing data.db found - keeping it as-is.` (o banco de produção foi mantido)
- `[seguranca-etapa1] Regras de segurança e separação por empresa aplicadas.`
- `[smtp-from-env] SMTP do Brevo configurado a partir das variáveis de ambiente.`
- `[fluxo-material] coleção solicitacoes_itens criada.`
- `[estoque-servidor] ... movimentação(ões) antiga(s) marcada(s) como histórico.`
- `[limpeza-inicial] ... concluída. Pode remover LIMPEZA_INICIAL dos Secrets.`
- possivelmente `[fix-schema-telas] ...` e `[seguranca-etapa1] ...: campo company_id criado.` / `...único por empresa.`

**Parar e avisar** se aparecer `failed to execute`, o app não subir, ou linha
`[seguranca-etapa1] Erro`, `[limpeza-inicial] Erro`, `[fluxo-material] Erro`, `[ocorrencias] Erro`.
Avisos esperados e inofensivos: `[estoque-minimo] E-mail não enviado` (só se o Brevo não estiver configurado).

### 7. Tirar a `LIMPEZA_INICIAL`
Depois de ver `[limpeza-inicial] ... concluída`, apagar `LIMPEZA_INICIAL` dos Secrets.
Se ficar, não faz mal: ela não roda duas vezes.

### 8. Telas na Hostinger (se as pessoas abrem o app pelo endereço da Hostinger)
O `.zip` já leva as telas novas: em `https://appobra-backend.fly.dev` o app novo já funciona. Mas se a equipe
abre o app por um endereço da Hostinger, **esse endereço continua com as telas antigas** até ser atualizado:
- baixar a pasta **`pb_public/`** do `main` (é a versão de produção já pronta, apontando para o Fly);
- Hostinger → Gerenciador de arquivos → pasta do site do app → **substituir todo o conteúdo** pelo conteúdo
  de `pb_public/` (inclui `index.html`, `.htaccess` e a pasta `assets/`);
- colocar esse endereço em `FRONT_URL` nos Secrets do Fly (ex.: `https://app.dnmltda.com.br`), para os
  botões dos e-mails abrirem no mesmo endereço. Sem `FRONT_URL`, os e-mails abrem no `appobra-backend.fly.dev`,
  que também funciona.

### 9. Teste rápido em produção (Diego, ~15 min)
1. Entrar com `dnmltda@hotmail.com` pelas abas **E-mail**, **Usuário** e **ID** (ID `01`).
2. **Esqueci minha senha** com o próprio e-mail → chega e-mail com o botão "Criar nova senha".
3. Funcionários → cadastrar um funcionário com e-mail real → chega o **convite** com o botão "Criar minha
   senha" → a pessoa cria a senha e entra.
4. Materiais → cadastrar "Cimento" com **unidade saco** e **estoque mínimo 5** → Estoque → **Registrar Entrada** de 10.
5. Solicitações → **Nova Solicitação** de Material com 6 sacos → Aprovar → Começar a separar → Entregar
   (estoque cai para 4) → aparece **"Materiais acabando"** e chega o e-mail "Estoque baixo".
6. Estoque → **Conferir** o cimento → contar 3 → escolher o motivo → estoque vai para 3.
7. Equipamentos → cadastrar um equipamento → **Emprestar** → **Receber de volta** ("Voltou bom").
8. Ocorrências → **Registrar ocorrência** com foto.
9. Compras → criar uma compra com item → marcar como Recebido → o material entra no estoque.

### Se algo der errado
- **App não sobe / erro grave:** Fly.io → `appobra-backend` → **Releases** → voltar para a versão anterior.
- **Dados errados depois da limpeza:** restaurar o snapshot do passo 1 (Volumes → snapshot → restore) e
  avisar o Claude Code com o trecho do log.

---

## O que vai para o ar (resumo)

| Etapa | O quê | Detalhes |
|---|---|---|
| 1 — Segurança | empresas separadas de verdade, funcionário não vira administrador, logs imutáveis | `docs/auditoria/etapa1-seguranca.md` |
| 2 — Estoque | saldo calculado pelo servidor, nunca negativo, compra recebida entra no estoque | `docs/auditoria/etapa2-estoque.md` |
| 3 — Telas | compras, login por ID/usuário, esqueci a senha, listas no lugar de texto, excluir = arquivar, ID por ordem de chegada, estoque começa vazio | `docs/auditoria/etapa3-telas.md` |
| 4 — Fluxos | pedido de material até a baixa; empréstimo de equipamento; conferir estoque com autorização; Ocorrências; alerta de estoque mínimo; e-mails com botão e convite com link certo | `docs/auditoria/etapa4-fluxos.md` |
