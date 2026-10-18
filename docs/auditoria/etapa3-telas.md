# Etapa 3 — Telas mais simples e que funcionam de verdade

Data: 18/10/2026 · Feita pelo Claude Code · Sobre as Etapas 1 e 2
Status: **testada localmente (servidor + navegador), ainda NÃO publicada**.

O código-fonte das telas agora está no GitHub em `frontend/` (veio de
`C:\Users\Diego\Documents\appobra-app\apps\web`; conferido que gerava exatamente a versão publicada).
**Daqui para frente as telas são alteradas no GitHub, não no Horizons**, senão as duas cópias se separam.

## Testes

- Servidor: `docs/auditoria/testes/audit_tests.py` → **123/0** (`resultado-etapa3.json`).
- Navegador (Playwright, clicando nas telas): `docs/auditoria/testes/navegador/` → 7 roteiros, **68
  verificações, todas OK** (compra completa, estoque, permissões por cargo, login/recuperação de senha
  com e-mail real capturado, troca de senha, "Fale conosco", listas).
- Todas as 38 telas abrem sem erro de consulta ao servidor.

## O que mudou para quem usa

**Funcionava mal ou não funcionava — corrigido**
- **Compras**: o formulário abria sem fornecedor, obra, material e usuário para escolher (uma consulta
  errada zerava as quatro listas). Agora: criar compra → adicionar item → receber → o material entra no
  estoque sozinho.
- **Login pelas abas "ID" e "Usuário"**: nunca funcionaram. Agora funcionam. Se o mesmo ID e a mesma
  senha existirem em duas empresas, o app pede para entrar pelo e-mail (não entra na conta errada).
- **Esqueci minha senha**: não enviava nada. Agora chega um e-mail em português com o link; o link vale
  uma vez e expira.
- **Trocar a senha no perfil**: falhava (faltava a senha atual). Corrigido.
- **"Fale conosco"** fingia enviar. Agora chega em `dnmltda@hotmail.com`, e "Responder" vai para o cliente.
- **Alerta de documentos a vencer** era um texto fixo inventado. Agora mostra os documentos reais que
  vencem em até 30 dias.
- Mensagens de erro do servidor (ex.: "Saldo insuficiente: há 25 em estoque…") apareciam em branco.
  Agora aparecem.
- Mensagens em inglês nas telas de Obras, Fornecedores e Treinamentos foram traduzidas.

**Mais simples**
- **Excluir** não apaga mais de verdade: o item some da lista e fica arquivado (o histórico continua com o
  nome). Dá para cadastrar de novo o mesmo CNPJ/placa. Usuário "excluído" fica inativo e pode ser reativado.
- **Estoque**: o saldo no cadastro do material só se lê ("muda só por entrada, saída ou inventário"). No
  Inventário, a tela pede a "quantidade contada" e explica que o estoque passa a ser esse número.
- **Listas no lugar de digitação**: Cargo (Gestão de Acessos), origem/destino e centro de custo
  (Movimentações), item e local (Perdas e Ganhos), cliente (Contas a Receber), local (Equipamentos).
  Categoria, código e unidade da movimentação vêm do material, sem digitar.
- Cabeçalho mostra o cargo ("Administrador") em vez de "admin".

**Permissões (uma regra só para menu, endereço e tela — `frontend/src/lib/permissoes.js`)**
- Telas que abriam para qualquer pessoa logada digitando o endereço agora respeitam o cargo:
  Cadastro de Empresas, Clientes, Propostas, Contas a Pagar/Receber, Frota, RH, QR Code, Perdas e Ganhos,
  detalhe de usuário.
- Gerência e Engenheiro passam a ser reconhecidos nas telas de estoque (antes caíam como funcionário).
- Um Almoxarife convidado não perde mais as permissões (o cargo vale mais que o "role").

## Arquivos principais

| Onde | O quê |
|---|---|
| `pb_hooks/login-e-senha.pb.js` (novo) | login por usuário e por ID, "esqueci minha senha", e-mail em português, `FRONT_URL` |
| `pb_hooks/contato.pb.js` (novo) | "Fale conosco" por e-mail (`CONTATO_EMAIL`, padrão dnmltda@hotmail.com) |
| `pb_hooks/seguranca-etapa1.pb.js` | excluir = arquivar; correção do bloqueio de busca pelo token (quebrava o login por e-mail) |
| `pb_hooks/log-security-event.pb.js` | hook antigo de materiais/equipamentos só age se faltar isolamento |
| `frontend/src/lib/permissoes.js`, `lib/erros.js` (novos) | permissões únicas; mensagem de erro legível |
| `frontend/src/contexts/AuthContext.jsx` | login, recuperação e troca de senha |
| `appobra_deploy_final.zip` | servidor + **telas novas em `pb_public/`** |

## Como publicar (Cowork/Diego)

Junto com as Etapas 1 e 2 (ver `etapa1-seguranca.md`, passos de backup e conferência dos logs). Além disso:

1. **Secrets do Fly** (`appobra-backend`):
   - `BREVO_SMTP_LOGIN` e `BREVO_SMTP_KEY` (e-mails);
   - `FRONT_URL` = endereço onde as pessoas abrem o app, sem barra no final
     (ex.: `https://app.dnmltda.com.br`) — é o link que vai no e-mail de "Esqueci minha senha";
   - opcional `CONTATO_EMAIL` (padrão `dnmltda@hotmail.com`).
2. **Telas**: o `.zip` já leva as telas novas (o Fly serve em `https://appobra-backend.fly.dev`). Se as
   pessoas usam o endereço da Hostinger, gerar e subir lá também:
   `cd frontend && npm ci && npx vite build --outDir dist` → enviar o conteúdo de `dist/` para a pasta do
   site na Hostinger (substituindo o anterior).
3. Teste rápido em produção: entrar pelas abas E-mail, Usuário e ID; "Esqueci minha senha" com seu e-mail;
   criar uma compra com item; excluir um fornecedor de teste.

## Fica para depois

- Fluxos que faltam do documento mestre (Etapa 4): solicitação com itens → separação → entrega →
  confirmação; empréstimo e devolução de equipamento; divergência de estoque; Ocorrências; alerta de
  estoque mínimo.
- Restringir no servidor quem aprova movimentação (hoje a tela já restringe; o servidor aceita qualquer
  usuário da empresa).
- Estoque de EPI ainda é calculado na tela.
- Limite de tentativas de login no servidor (o da tela nunca funcionou e foi removido).
- Limpeza (Etapa 5): tabelas duplicadas e campos inglês/português.
