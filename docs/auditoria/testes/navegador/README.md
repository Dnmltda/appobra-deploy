# Testes no navegador (Playwright)

Clicam nas telas como um usuário faria, contra o servidor LOCAL de teste (nunca produção).

Pré-requisitos (além do servidor local do `../README.md`, com as empresas A e B criadas):

```bash
# 1. Telas apontando para o servidor local
cd frontend && npm ci
VITE_POCKETBASE_URL=http://127.0.0.1:8097 npx vite build --outDir /tmp/front_dist
npx vite preview --outDir /tmp/front_dist --port 4173 &

# 2. Servidor de e-mail falso (captura os e-mails de recuperação de senha e "Fale conosco")
python3 docs/auditoria/testes/navegador/smtp_sink.py /tmp/emails 2525 &

# 3. Cada teste com banco novo (o teste altera os dados)
cd docs/auditoria/testes/navegador
SINK=/tmp/emails node login.mjs
```

Variáveis: `FRONT` (padrão http://127.0.0.1:4173), `API` (http://127.0.0.1:8097), `CHROME` (caminho do
Chromium), `PLAYWRIGHT_DIR` (pasta onde o pacote `playwright` está instalado).

| Arquivo | O que testa |
|---|---|
| `compra.mjs` | criar compra, item, recebimento → material entra no estoque |
| `estoque.mjs` | entrada, saída barrada/recusada, inventário, saldo travado no cadastro |
| `permissoes.mjs` | menu e rotas por cargo (Almoxarife, Gerência, Pedreiro, Administrador) |
| `login.mjs` | login por e-mail/usuário/ID, conta inativa, esqueci a senha com link real |
| `perfil-senha.mjs` | troca de senha pelo perfil |
| `honestidade.mjs` | "Fale conosco" envia e-mail, alerta de documento real, excluir = arquivar |
| `selecoes.mjs` | listas no lugar de texto livre (movimentações, perdas, contas a receber, equipamentos) |
| `ids-materiais.mjs` | estoque começa vazio, sugestão de material, ID por ordem de chegada (só leitura) |
| `convite.mjs` | convite de funcionário: e-mail com botão, link certo, cria a senha e entra |
| `equipamento.mjs` | emprestar equipamento, atraso, receber de volta com o estado (manutenção) |
| `divergencia.mjs` | conferir estoque: diferença com motivo, aguarda autorização, administrador autoriza |
| `ocorrencias.mjs` | ocorrência com foto e gravidade alta, e-mail para a chefia, resolver com o que foi feito |
| `estoque-minimo.mjs` | material chega no mínimo: painel, sininho, e-mail, pedir compra sem duplicar |
| `fluxo-material.mjs` | pedido de material com itens: pedir → aprovar → separar → entregar (baixa) → confirmar |
